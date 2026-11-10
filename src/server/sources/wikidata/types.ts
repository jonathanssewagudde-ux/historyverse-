/** Subset of the Wikibase JSON model that HISTORYVERSE reads. */
export interface WbTime {
  time: string;
  precision: number;
  calendarmodel?: string;
}
export interface WbEntityId {
  id: string;
}
export interface WbCoordinate {
  latitude: number;
  longitude: number;
}
export interface WbMonolingual {
  text: string;
  language: string;
}
export type WbValue = WbTime | WbEntityId | WbCoordinate | WbMonolingual | string | { amount: string };

export interface WbSnak {
  snaktype: "value" | "somevalue" | "novalue";
  property: string;
  datavalue?: { type: string; value: WbValue };
}
export interface WbStatement {
  id?: string;
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: WbSnak;
  qualifiers?: Record<string, WbSnak[]>;
}
export interface WbEntity {
  id: string;
  lastrevid?: number;
  modified?: string;
  labels: Record<string, { value: string }>;
  descriptions: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims: Record<string, WbStatement[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
}
