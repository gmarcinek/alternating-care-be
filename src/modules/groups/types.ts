export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: Array<{ userId: string; role: "admin" | "member" | "viewer" }>;
  createdAt: string;
}
