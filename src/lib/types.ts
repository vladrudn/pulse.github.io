export type RequestStatus = "processed";
export type RequestSource = "manual" | "sedo";
export type AidKind = "wellness" | "material";

export type Person = {
  id: string;
  taxId: string;
  unit: string;
  rank: string;
  fullName: string;
  fullNameDative: string;
  position: string;
  category: "Офіцерський" | "Сержантський" | "Рядовий";
  flags: string[];
};

export type SedoReport = {
  id: string;
  personId: string;
  number: string;
  date: string;
  registeredAt: string;
  correspondent: string;
  subject: string;
};

export type AidRequest = {
  id: string;
  personId: string;
  aidKind: AidKind;
  source: RequestSource;
  sedoId?: string;
  reportNumber: string;
  reportDate: string;
  orderDate: string;
  bases?: string[];
  // Legacy fields retained for existing browser data.
  circumstances?: string;
  vlk?: string;
  status: RequestStatus;
  createdAt: string;
  processedAt?: string;
};

export type WorkspaceState = {
  requests: AidRequest[];
};
