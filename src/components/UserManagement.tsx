import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldOff } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  isAdmin: boolean;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionType, setActionType] = useState<"grant" | "revoke" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      // Combine the data
      const adminUserIds = new Set(roles?.map(r => r.user_id) || []);
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        isAdmin: adminUserIds.has(profile.id),
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAdmin = (user: UserProfile) => {
    setSelectedUser(user);
    setActionType("grant");
  };

  const handleRevokeAdmin = (user: UserProfile) => {
    setSelectedUser(user);
    setActionType("revoke");
  };

  const confirmAction = async () => {
    if (!selectedUser || !actionType) return;

    try {
      if (actionType === "grant") {
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: selectedUser.id,
            role: "admin",
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: `Admin rights granted to ${selectedUser.email}`,
        });
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", selectedUser.id)
          .eq("role", "admin");

        if (error) throw error;

        toast({
          title: "Success",
          description: `Admin rights revoked from ${selectedUser.email}`,
        });
      }

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSelectedUser(null);
      setActionType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">User Management</h2>
          <Button onClick={fetchUsers} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || "-"}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Shield className="h-4 w-4" />
                        Admin
                      </span>
                    ) : (
                      <span className="text-muted-foreground">User</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeAdmin(user)}
                        className="gap-2"
                      >
                        <ShieldOff className="h-4 w-4" />
                        Revoke Admin
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleGrantAdmin(user)}
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        Grant Admin
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "grant" ? "Grant Admin Rights" : "Revoke Admin Rights"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "grant"
                ? `Are you sure you want to grant admin rights to ${selectedUser?.email}? They will have full access to manage content and users.`
                : `Are you sure you want to revoke admin rights from ${selectedUser?.email}? They will no longer be able to access the admin area.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
