import { Server } from "socket.io";
import * as logger from "./logger.mjs";

const SURVEY_TEAM_ROOM = "survey-team";

/** @typedef {"echo" | "mirage" | "powerfist"} SurveyTeamRole */

/**
 * @typedef {object} SurveyTeamMember
 * @property {string} socketId
 * @property {SurveyTeamRole} role
 * @property {string} [nodeId]
 * @property {string} [deviceId]
 * @property {string} [label]
 * @property {number} joinedAt
 */

/**
 * @param {import("node:http").Server} httpServer
 */
export function attachSurveyTeamHub(httpServer) {
  const io = new Server(httpServer, {
    path: "/survey-team",
    cors: { origin: "*", methods: ["GET", "POST"] },
    serveClient: false,
  });

  /** @type {Map<string, SurveyTeamMember>} */
  const members = new Map();

  function teamStatusPayload() {
    const mirages = [];
    const powerfists = [];

    for (const member of members.values()) {
      if (member.role === "mirage") mirages.push(member.nodeId ?? member.socketId.slice(0, 8));
      if (member.role === "powerfist") powerfists.push(member.deviceId ?? member.socketId.slice(0, 8));
    }

    return {
      echo: true,
      mirages,
      powerfists,
      memberCount: members.size,
    };
  }

  function broadcastTeamStatus() {
    const payload = teamStatusPayload();
    io.to(SURVEY_TEAM_ROOM).emit("survey:team-status", payload);
    return payload;
  }

  io.on("connection", (socket) => {
    logger.log(`survey-team: connect ${socket.id}`);

    socket.on("survey:join", (raw) => {
      const role = raw?.role;
      if (role !== "echo" && role !== "mirage" && role !== "powerfist") {
        socket.emit("survey:error", { reason: "role must be echo, mirage, or powerfist" });
        return;
      }

      const member = {
        socketId: socket.id,
        role,
        nodeId: typeof raw?.nodeId === "string" ? raw.nodeId.trim() : undefined,
        deviceId: typeof raw?.deviceId === "string" ? raw.deviceId.trim() : undefined,
        label: typeof raw?.label === "string" ? raw.label.trim() : undefined,
        joinedAt: Date.now(),
      };

      members.set(socket.id, member);
      socket.join(SURVEY_TEAM_ROOM);
      socket.emit("survey:joined", { ok: true, ...teamStatusPayload() });
      broadcastTeamStatus();
      logger.log(`survey-team: ${role} joined (${socket.id.slice(0, 8)}…)`);
    });

    socket.on("survey:mirage-queue-control", (payload) => {
      if (!payload?.control) return;
      socket.broadcast.emit("survey:mirage-queue-control", payload);
    });

    socket.on("disconnect", () => {
      members.delete(socket.id);
      broadcastTeamStatus();
      logger.log(`survey-team: disconnect ${socket.id}`);
    });
  });

  return {
    io,
    /** @param {object} bundle */
    pushPairingBundle(bundle) {
      const payload = {
        echoHost: bundle.host,
        httpPort: bundle.port,
        miragePin: bundle.pin,
        mirageUrl: bundle.mirageUrl ?? null,
        echoNodeId: bundle.echoNodeId ?? null,
        sessionEpoch: bundle.sessionEpoch ?? null,
        sentAt: new Date().toISOString(),
      };

      let delivered = 0;
      for (const [socketId, member] of members.entries()) {
        if (member.role !== "mirage") continue;
        io.to(socketId).emit("survey:pairing-bundle", payload);
        delivered += 1;
      }

      logger.log(`survey-team: pairing-bundle → ${delivered} mirage client(s)`);
      return { delivered, payload };
    },

    /** @param {{ role: SurveyTeamRole, nodeId?: string, deviceId?: string }} input */
    notifyLinked(input) {
      const payload = {
        role: input.role,
        nodeId: input.nodeId ?? null,
        deviceId: input.deviceId ?? null,
        at: new Date().toISOString(),
      };
      io.to(SURVEY_TEAM_ROOM).emit("survey:linked", payload);
      broadcastTeamStatus();
    },

    broadcastTeamStatus,
    teamStatusPayload,
  };
}
