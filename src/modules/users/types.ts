export interface AppUser {
  id: string;        // org.couchdb.user:<email>
  email: string;
  name: string;
  rolesByGroup: Record<string, "admin" | "member" | "viewer">;
}
