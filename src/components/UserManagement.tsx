import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldOff, UserCog, UserPlus, Key, Search, Hash } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserComplianceView } from "./UserComplianceView";
import { usernameToEmail, emailToUsername } from "@/lib/auth-utils";
import { isSuperAdminEmail } from "@/lib/super-admin";


interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  user_types: string[];
  driver_number: number | null;
  driver_pin: string | null;
  isAdmin: boolean;
  isCustomer: boolean;
  customerNames: string[];
}

const USER_TYPES = [
  { value: "driver", label: "Driver" },
  { value: "yard", label: "Yard" },
  { value: "office", label: "Office" },
  { value: "management", label: "Management" },
];

type StaffTab = "all" | "office" | "yard" | "driver" | "management" | "unassigned";

export const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionType, setActionType] = useState<"grant" | "revoke" | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [editName, setEditName] = useState("");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserTypes, setNewUserTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [driverUser, setDriverUser] = useState<UserProfile | null>(null);
  const [driverNumber, setDriverNumber] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);
  const [routeDrivers, setRouteDrivers] = useState<{ id: string; driver_name: string; driver_number: number | null; pin: string | null }[]>([]);
  const [topTab, setTopTab] = useState<"staff" | "customers">("staff");
  const [staffTab, setStaffTab] = useState<StaffTab>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchRouteDrivers();
  }, []);

  const fetchRouteDrivers = async () => {
    const { data, error } = await supabase
      .from("route_one_drivers")
      .select("id, driver_name, driver_number, pin")
      .eq("is_active", true)
      .order("driver_number", { ascending: true });
    if (!error && data) setRouteDrivers(data as any);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const [profilesRes, rolesRes, membershipsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
        supabase.from("customer_portal_memberships").select("user_id, customers(customer_name)"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (membershipsRes.error) throw membershipsRes.error;

      const adminUserIds = new Set(rolesRes.data?.map(r => r.user_id) || []);
      const customerMap = new Map<string, string[]>();
      (membershipsRes.data || []).forEach((m: any) => {
        const list = customerMap.get(m.user_id) || [];
        const name = m.customers?.customer_name;
        if (name && !list.includes(name)) list.push(name);
        customerMap.set(m.user_id, list);
      });

      const usersWithRoles: UserProfile[] = (profilesRes.data || []).map(profile => ({
        ...profile,
        user_types: profile.user_types || [],
        isAdmin: adminUserIds.has(profile.id),
        isCustomer: customerMap.has(profile.id),
        customerNames: customerMap.get(profile.id) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAdmin = (user: UserProfile) => { setSelectedUser(user); setActionType("grant"); };
  const handleRevokeAdmin = (user: UserProfile) => { setSelectedUser(user); setActionType("revoke"); };
  const handleEditTypes = (user: UserProfile) => { setEditingUser(user); setSelectedTypes(user.user_types || []); setEditName(user.full_name || ""); };
  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const saveUserTypes = async () => {
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          user_types: selectedTypes as ("driver" | "yard" | "office" | "management")[],
          full_name: editName.trim() || null,
        })
        .eq("id", editingUser.id);
      if (error) throw error;
      toast({ title: "Success", description: `User updated for ${emailToUsername(editingUser.email)}` });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setEditingUser(null);
      setSelectedTypes([]);
      setEditName("");
    }
  };


  const handleCreateUser = async () => {
    if (!newUsername.trim()) {
      toast({ title: "Error", description: "Username is required", variant: "destructive" });
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(newUsername.trim())) {
      toast({ title: "Error", description: "Username can only contain letters, numbers, dots, underscores, and hyphens", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const email = usernameToEmail(newUsername);
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, full_name: newUserName.trim() || null, user_types: newUserTypes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "User Created", description: `User "${newUsername}" has been created. Set their password using the Password button.` });
      setShowCreateDialog(false);
      setNewUsername("");
      setNewUserName("");
      setNewUserTypes([]);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleNewUserTypeToggle = (type: string) => {
    setNewUserTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleSetPassword = (user: UserProfile) => { setPasswordUser(user); setNewPassword(""); };

  const savePassword = async () => {
    if (!passwordUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-user-password", {
        body: { user_id: passwordUser.id, password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Success", description: `Password updated for ${emailToUsername(passwordUser.email)}` });
      setPasswordUser(null);
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleSetDriver = (user: UserProfile) => {
    setDriverUser(user);
    setDriverNumber(user.driver_number?.toString() || "");
    setDriverPin(user.driver_pin || "");
  };

  const applyRouteDriver = (id: string) => {
    const d = routeDrivers.find(r => r.id === id);
    if (!d) return;
    if (d.driver_number != null) setDriverNumber(d.driver_number.toString());
    if (d.pin) setDriverPin(d.pin);
  };

  const saveDriver = async () => {
    if (!driverUser) return;
    const num = driverNumber.trim() ? parseInt(driverNumber.trim(), 10) : null;
    const pin = driverPin.trim() || null;
    if (num !== null && (pin === null || pin.length < 4)) {
      toast({ title: "Error", description: "PIN must be at least 4 digits", variant: "destructive" });
      return;
    }
    setSavingDriver(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ driver_number: num, driver_pin: pin })
        .eq("id", driverUser.id);
      if (error) throw error;
      toast({ title: "Success", description: `Driver login updated for ${emailToUsername(driverUser.email)}` });
      setDriverUser(null);
      fetchUsers();
    } catch (error: any) {
      const msg = error.message?.includes("duplicate") || error.code === "23505"
        ? "That driver number is already in use"
        : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSavingDriver(false);
    }
  };

  const confirmAction = async () => {
    if (!selectedUser || !actionType) return;
    try {
      if (actionType === "grant") {
        const { error } = await supabase.from("user_roles").insert({ user_id: selectedUser.id, role: "admin" });
        if (error) throw error;
        toast({ title: "Success", description: `Admin rights granted to ${emailToUsername(selectedUser.email)}` });
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", selectedUser.id).eq("role", "admin");
        if (error) throw error;
        toast({ title: "Success", description: `Admin rights revoked from ${emailToUsername(selectedUser.email)}` });
      }
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSelectedUser(null);
      setActionType(null);
    }
  };

  // Partition users
  const { staffUsers, customerUsers } = useMemo(() => {
    const staff: UserProfile[] = [];
    const customers: UserProfile[] = [];
    for (const u of users) {
      if (u.isCustomer) customers.push(u);
      else staff.push(u);
    }
    return { staffUsers: staff, customerUsers: customers };
  }, [users]);

  const filterBySearch = (list: UserProfile[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(u =>
      emailToUsername(u.email).toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q) ||
      u.customerNames.some(c => c.toLowerCase().includes(q))
    );
  };

  const filteredStaff = useMemo(() => {
    let list = staffUsers;
    if (staffTab === "unassigned") {
      list = list.filter(u => !u.user_types || u.user_types.length === 0);
    } else if (staffTab !== "all") {
      list = list.filter(u => u.user_types?.includes(staffTab));
    }
    return filterBySearch(list);
  }, [staffUsers, staffTab, search]);

  const filteredCustomers = useMemo(() => filterBySearch(customerUsers), [customerUsers, search]);

  const counts = useMemo(() => ({
    all: staffUsers.length,
    office: staffUsers.filter(u => u.user_types?.includes("office")).length,
    yard: staffUsers.filter(u => u.user_types?.includes("yard")).length,
    driver: staffUsers.filter(u => u.user_types?.includes("driver")).length,
    management: staffUsers.filter(u => u.user_types?.includes("management")).length,
    unassigned: staffUsers.filter(u => !u.user_types || u.user_types.length === 0).length,
    customers: customerUsers.length,
  }), [staffUsers, customerUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderStaffActions = (user: UserProfile) => (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => handleEditTypes(user)} className="gap-1">
        <UserCog className="h-4 w-4" /> Types
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleSetPassword(user)} className="gap-1">
        <Key className="h-4 w-4" /> Password
      </Button>
      {user.user_types?.includes("driver") && (
        <Button variant="outline" size="sm" onClick={() => handleSetDriver(user)} className="gap-1">
          <Hash className="h-4 w-4" /> Driver No.
        </Button>
      )}
      {user.isAdmin ? (
        <Button variant="outline" size="sm" onClick={() => handleRevokeAdmin(user)} className="gap-1">
          <ShieldOff className="h-4 w-4" /> Revoke
        </Button>
      ) : (
        <Button variant="default" size="sm" onClick={() => handleGrantAdmin(user)} className="gap-1">
          <Shield className="h-4 w-4" /> Admin
        </Button>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-2xl font-bold">User Management</h2>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1">
              <UserPlus className="h-4 w-4" /> Create User
            </Button>
            <Button onClick={fetchUsers} variant="outline" size="sm">Refresh</Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Tabs value={topTab} onValueChange={(v) => setTopTab(v as "staff" | "customers")}>
          <TabsList>
            <TabsTrigger value="staff">Staff ({staffUsers.length})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({counts.customers})</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Tabs value={staffTab} onValueChange={(v) => setStaffTab(v as StaffTab)}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="office">Office ({counts.office})</TabsTrigger>
                <TabsTrigger value="yard">Yard ({counts.yard})</TabsTrigger>
                <TabsTrigger value="driver">Drivers ({counts.driver})</TabsTrigger>
                <TabsTrigger value="management">Management ({counts.management})</TabsTrigger>
                <TabsTrigger value="unassigned">Unassigned ({counts.unassigned})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>User Types</TableHead>
                    <TableHead>Driver #</TableHead>
                    <TableHead>Compliance Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No staff users found.
                      </TableCell>
                    </TableRow>
                  ) : filteredStaff.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{emailToUsername(user.email)}</TableCell>
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
                        {user.driver_number != null ? (
                          <Badge variant="outline" className="font-mono">{user.driver_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <UserComplianceView userId={user.id} userTypes={user.user_types} userName={user.full_name || user.email} />
                      </TableCell>
                      <TableCell>
                        {isSuperAdminEmail(user.email) ? (
                          <span className="inline-flex items-center gap-1 text-primary font-semibold">
                            <Shield className="h-4 w-4" /> Super Admin
                          </span>
                        ) : user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Shield className="h-4 w-4" /> Admin
                          </span>
                        ) : (
                          <span className="text-muted-foreground">User</span>
                        )}
                      </TableCell>

                      <TableCell>{renderStaffActions(user)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Customer(s)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No customer portal users found.
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{emailToUsername(user.email)}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.customerNames.map(name => (
                            <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleSetPassword(user)} className="gap-1">
                          <Key className="h-4 w-4" /> Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the name and roles for {editingUser ? emailToUsername(editingUser.email) : ""}. Roles determine which RAMS and Toolbox Talks are relevant to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full name</Label>
              <Input
                id="edit-full-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Jamie Clews"
              />
            </div>
            <div className="space-y-3">
              <Label>User types</Label>
              {USER_TYPES.map(type => (
                <div key={type.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={type.value}
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => handleTypeToggle(type.value)}
                  />
                  <Label htmlFor={type.value} className="cursor-pointer">{type.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={saveUserTypes}>Save Changes</Button>
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
                ? `Are you sure you want to grant admin rights to ${selectedUser ? emailToUsername(selectedUser.email) : ""}? They will have full access to manage content and users.`
                : `Are you sure you want to revoke admin rights from ${selectedUser ? emailToUsername(selectedUser.email) : ""}? They will no longer be able to access the admin area.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system. Set their password after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input id="username" type="text" placeholder="john.smith" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <p className="text-xs text-muted-foreground">Letters, numbers, dots, underscores, and hyphens only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="John Smith" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>User Types</Label>
              <div className="space-y-2">
                {USER_TYPES.map(type => (
                  <div key={type.value} className="flex items-center space-x-3">
                    <Checkbox id={`new-${type.value}`} checked={newUserTypes.includes(type.value)} onCheckedChange={() => handleNewUserTypeToggle(type.value)} />
                    <Label htmlFor={`new-${type.value}`} className="cursor-pointer">{type.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creating}>{creating ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={!!passwordUser} onOpenChange={() => setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>Set a new password for {passwordUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" placeholder="Enter new password (min 6 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>Cancel</Button>
            <Button onClick={savePassword} disabled={settingPassword || newPassword.length < 6}>{settingPassword ? "Saving..." : "Set Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Driver Number Dialog */}
      <Dialog open={!!driverUser} onOpenChange={() => setDriverUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Driver App Login</DialogTitle>
            <DialogDescription>
              Set the PIN {driverUser ? emailToUsername(driverUser.email) : ""} uses to sign into the RouteOne driver app. They log in with their <strong>username</strong> ({driverUser ? emailToUsername(driverUser.email) : ""}) and this PIN. Leave the PIN blank to remove access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assign from RouteOne Setup</Label>
              <Select onValueChange={applyRouteDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a RouteOne driver..." />
                </SelectTrigger>
                <SelectContent>
                  {routeDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.driver_number != null ? `#${d.driver_number} — ` : ""}{d.driver_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Picks the driver number (and PIN) from RouteOne. You can still edit below.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverNumber">Driver Number</Label>
              <Input
                id="driverNumber"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 14"
                value={driverNumber}
                onChange={(e) => setDriverNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverPin">PIN (4-6 digits)</Label>
              <Input
                id="driverPin"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 1234"
                value={driverPin}
                onChange={(e) => setDriverPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriverUser(null)}>Cancel</Button>
            <Button onClick={saveDriver} disabled={savingDriver}>{savingDriver ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
