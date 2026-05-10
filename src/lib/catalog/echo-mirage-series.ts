export type CatalogSpecificationSection = {
  heading: string;
  items: string[];
};

export type CatalogMoment = {
  configurationId: string;
  title: string;
  coverImage: string;
  coverAlt: string;
  manifestLine: string;
  narrative: string;
  specifications: CatalogSpecificationSection[];
  deploymentNotes: string[];
};

export const ECHO_MIRAGE_SERIES_MOMENT: CatalogMoment = {
  configurationId: "EM-SERIES-01",
  title: "Echo Mirage Series",
  coverImage: "/catalog/echo-mirage-series-em-series-01.png",
  coverAlt:
    "Echo Mirage Series EM-SERIES-01 deployment cyberdeck by Craftwerk Cyberdeck Corporation — rugged case, terminal HUD, field setup",
  manifestLine: "CURRENT PRODUCTION LINE // ECHO MIRAGE SERIES",
  narrative:
    "Field-terminal architecture for sovereign operators: sealed chassis, threaded power, split command surface. " +
    "Configured as Craftwerk Cyberdeck Corporation’s Echo Mirage line — classified manifest item, deployment ready.",
  specifications: [
    {
      heading: "Hardware core",
      items: [
        "Ruggedized field housing — EMI-aware seam geometry",
        "Modular front I/O fascia — sealed connector wells",
        "Split-pane command surface — daylight-biased matte stack",
      ],
    },
    {
      heading: "Modules",
      items: [
        "Operator input plane — compact mechanical cluster",
        "Hot-service storage bay — dual NVMe profile (field kit)",
        "Auxiliary telemetry lane — discrete sensor header",
      ],
    },
    {
      heading: "Power systems",
      items: [
        "Threaded USB-C locking lead — vibration-rated",
        "Intelligent PMIC rail — brownout holdover profile",
        "Isolated charging path — ground lift for bench work",
      ],
    },
    {
      heading: "Display",
      items: [
        "Square-ratio panel — calibrated for HUD tiles",
        "Low-latency scan — reduced judder under motion",
      ],
    },
    {
      heading: "Connectivity",
      items: ["USB-A / USB-C matrix", "HDMI field link", "Digital + AUX + optical egress"],
    },
    {
      heading: "Operating stack",
      items: ["Echo Mirage terminal shell", "Encrypted session vault hooks", "Operator diagnostics tether"],
    },
  ],
  deploymentNotes: [
    "Manifest entry for single production line — additional models deferred.",
    "Ships bench-verified; field acceptance per operator checklist EM-PROTO-7.",
    "No retail cartography — procurement via Craftwerk routing only.",
  ],
};
