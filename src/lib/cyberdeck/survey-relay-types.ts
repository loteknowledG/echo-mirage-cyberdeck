export type SurveyRelayBundleClient = {
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  miragePin: string;
  powerfistPin: string | null;
  sessionEpoch: number;
  echoSurveyActive: boolean;
  sentAt: string;
  expiresAt: string;
};
