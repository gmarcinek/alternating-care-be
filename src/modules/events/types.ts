export enum CalendarEventType {
  Offset = "OFFSET",
  Alternating = "ALTERNATING",
  Event = "EVENT",
  Trip = "TRIP",
  Birthday = "BIRTHDAY",
  Medical = "MEDICAL",
  School = "SCHOOL",
  Camp = "CAMP"
}

export interface CalendarEvent {
  id: string;            // _id
  groupId: string;
  date: string;          // YYYY-MM-DD
  type: CalendarEventType;
  creatorId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _rev?: string;
}
