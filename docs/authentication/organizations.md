# Organizations, Members, Projects, Groups, and Roles

Organizations let you manage shared API usage, billing, members, projects, API keys, and access control from one dashboard.

## Personal and Team Organizations

Every account has a default **Personal organization**. You can use it as your default workspace for personal API usage and access management.

Personal organizations have a permanent owner:

- The owner cannot leave or remove themselves from the Personal organization.
- The owner can invite and remove other members.
- Removing a member disables the member's organization-scoped API keys and admin keys for that organization.

Team organizations are separate shared workspaces. By default, each user can create up to **5 team organizations**.

## Members

Members are users who have joined an organization.

Owners can:

- Invite members by email.
- Edit a member's organization role.
- Remove members other than themselves from the organization.
- Assign additional access through custom roles and groups.

Readers can view organization resources but cannot manage billing, members, groups, roles, projects, or keys unless an owner assigns additional custom permissions.

## Invitations

Invitations are pending membership requests. An invitation becomes a member only after the recipient accepts it.

Invitation flow:

1. An owner sends one or more invitations by email.
2. If the recipient already has an Apertis account, they sign in and accept the invitation.
3. If the recipient does not have an account, they create one from the invite flow, then join the organization.
4. The new member appears in the Members tab after accepting.

Pending invitations can be revoked individually or in bulk. Revoking a pending invitation does not affect existing members.

Default limits:

| Limit                                     | Default |
| ----------------------------------------- | ------- |
| Personal organization members             | 50      |
| Personal organization pending invitations | 50      |
| Team organization pending invitations     | 50      |
| Team organizations per user               | 5       |

Limits may be adjusted for enterprise customers.

## Projects

Projects are usage and resource scopes inside an organization. Use them to separate environments, products, customers, or internal teams while keeping billing under the same organization.

Every organization has a default project. The default project cannot be archived or removed. Owners and members with project management permission can create additional projects.

Owners can:

- Create projects for shared workloads.
- Set an optional monthly project cap.
- Open **Manage project** to manage project API keys, project people, and service accounts.
- Archive non-default projects.

Project rules:

- Project members must already be organization members.
- Adding someone to a project does not invite them to the organization.
- Project-scoped API keys bill to the organization and can be limited to that project.
- Service accounts belong to a project and are intended for server-side automation.
- Archiving a project disables API keys scoped to that project.
- Monthly project caps are an extra spending gate. They do not change which organization balance or payment method is billed.

Large organization project lists are loaded with server-side pagination and search. Search by project name, slug, public project ID, or region to avoid loading every project into the browser.

## Groups

Groups collect organization members so you can assign access to multiple people at once.

Groups only contain users who are already organization members. Adding someone to a group does not invite them to the organization; invite and accept the member first, then add them to groups.

Owners can:

- Create a group with a name and description.
- Add or remove joined organization members through multi-select.
- Enable or disable a group.
- Delete a group.

Disabling a group pauses that group's role assignments. Members remain in the organization, and group membership is preserved. Deleting a group removes the group and its group role assignments; it does not remove members from the organization.

## Roles

Roles define reusable permission bundles. They are assigned to members or groups.

System roles provide baseline access:

| Role   | Purpose                                                                                 |
| ------ | --------------------------------------------------------------------------------------- |
| Owner  | Full organization administration, including members, billing, projects, roles, and keys |
| Reader | Read-only organization access                                                           |

Custom roles let owners grant more specific capabilities, such as billing management, project management, member management, API key management, or admin key management.

Role behavior:

- Custom roles can be assigned directly to one member.
- Custom roles can be assigned to a group, and every enabled group member inherits the role.
- Effective access is additive: direct member roles plus enabled group roles.
- Editing a custom role changes access for all assigned members and groups immediately.
- Deleting a custom role removes that role from assigned targets immediately.

## Projects vs. Groups vs. Roles

These controls solve different problems and are designed to be used together.

| Control      | What it is                                      | Use it for                                                          |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| **Projects** | API usage, key, people, and service scopes      | Separating production, staging, customers, products, or workloads   |
| **Groups**   | Collections of organization members            | Assigning the same access to multiple people                        |
| **Roles**    | Reusable permission bundles                     | Defining what a member or group can do                              |
| **Keys**     | Credentials used by apps, services, and people | Authenticating API requests or organization administration requests |

Effective access is additive:

- Organization role gives baseline access.
- Direct custom roles add capabilities to one member.
- Enabled group role assignments add capabilities to every member in that group.
- Project membership limits access to project-scoped resources.
- API key permission mode limits what that key can do, even if the creator has broader dashboard access.

## Recommended Access Flow

Use this sequence for predictable organization access:

1. Invite users to the organization.
2. Wait for users to accept and appear as members.
3. Create projects for workloads or environments.
4. Add joined members to the projects they need.
5. Create groups for teams, functions, or environments.
6. Add members to groups.
7. Create custom roles when the default Owner and Reader roles are too broad.
8. Assign roles to members or groups.
9. Create project keys or service accounts for shared services.
10. Review API keys, admin keys, usage, and audit logs after access changes.

## API Keys and Member Removal

Organization API keys are tied to an organization and, when applicable, to a project and owner.

When a member is removed from an organization:

- Their organization-scoped API keys are disabled.
- Their organization admin keys are revoked.
- Requests using those disabled keys are rejected.
- The organization audit log records the access change.

This keeps billing and access aligned with current organization membership.
