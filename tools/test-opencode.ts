const BASE_URL = "http://127.0.0.1:4096";

async function main() {
  // Create session
  const sessionRes = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent: "exec-dev",
    }),
  });

  const session = await sessionRes.json();

  console.log("SESSION:");
  console.log(session);

  const sessionID = session.id;

  // Send message
  const messageRes = await fetch(
    `${BASE_URL}/session/${sessionID}/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent: "exec-dev",
        parts: [
          {
            type: "text",
            text: `
# LEGIS-LEAD DIRECTIVE

## OBJECTIVE
Create a file named hello.txt containing:
HELLO ECHO MIRAGE
            `,
          },
        ],
      }),
    }
  );

  const message = await messageRes.json();

  console.log("MESSAGE:");
  console.log(JSON.stringify(message, null, 2));
}

main().catch(console.error);