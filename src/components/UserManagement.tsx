import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldOff, UserCog, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserComplianceView } from "./UserComplianceView";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  user_types: string[];
  isAdmin: boolean;
}

const USER_TYPES = [
  { value: "driver", label: "Driver" },
  { value: "yard", label: "Yard" },
  { value: "office", label: "Office" },
  { value: "management", label: "Management" },
];

export const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionType, setActionType] = useState<"grant" | "revoke" | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserTypes, setNewUserTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
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
        user_types: profile.user_types || [],
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

  const handleEditTypes = (user: UserProfile) => {
    setEditingUser(user);
    setSelectedTypes(user.user_types || []);
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const saveUserTypes = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ user_types: selectedTypes as ("driver" | "yard" | "office" | "management")[] })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User types updated for ${editingUser.email}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEditingUser(null);
      setSelectedTypes([]);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserEmail.trim(),
          full_name: newUserName.trim() || null,
          user_types: newUserTypes,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "User Created",
        description: `${newUserEmail} has been created. They can use password reset to set their password.`,
      });

      setShowCreateDialog(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserTypes([]);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleNewUserTypeToggle = (type: string) => {
    setNewUserTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
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
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1">
              <UserPlus className="h-4 w-4" />
              Create User
            </Button>
            <Button onClick={fetchUsers} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>User Types</TableHead>
                <TableHead>RAMS Compliance</TableHead>
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
                    <div className="flex flex-wrap gap-1">
                      {user.user_types && user.user_types.length > 0 ? (
                        user.user_types.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {USER_TYPES.find(t => t.value === type)?.label || type}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <UserComplianceView 
                      userId={user.id} 
                      userTypes={user.user_types} 
                      userName={user.full_name || user.email}
                    />
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTypes(user)}
                        className="gap-1"
                      >
                        <UserCog className="h-4 w-4" />
                        Types
                      </Button>
                      {user.isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeAdmin(user)}
                          className="gap-1"
                        >
                          <ShieldOff className="h-4 w-4" />
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleGrantAdmin(user)}
                          className="gap-1"
                        >
                          <Shield className="h-4 w-4" />
                          Admin
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit User Types Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Types</DialogTitle>
            <DialogDescription>
              Assign roles to {editingUser?.email}. These determine which RAMS and Toolbox Talks are relevant to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {USER_TYPES.map(type => (
              <div key={type.value} className="flex items-center space-x-3">
                <Checkbox
                  id={type.value}
                  checked={selectedTypes.includes(type.value)}
                  onCheckedChange={() => handleTypeToggle(type.value)}
                />
                <Label htmlFor={type.value} className="cursor-pointer">
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={saveUserTypes}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Role Confirmation Dialog */}
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

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>User Types</Label>
              <div className="space-y-2">
                {USER_TYPES.map(type => (
                  <div key={type.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={`new-${type.value}`}
                      checked={newUserTypes.includes(type.value)}
                      onCheckedChange={() => handleNewUserTypeToggle(type.value)}
                    />
                    <Label htmlFor={`new-${type.value}`} className="cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
