# Organizations, Members, Groups, and Roles

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

## Recommended Access Flow

Use this sequence for predictable organization access:

1. Invite users to the organization.
2. Wait for users to accept and appear as members.
3. Create groups for teams, functions, or environments.
4. Add members to groups.
5. Create custom roles when the default Owner and Reader roles are too broad.
6. Assign roles to members or groups.
7. Review API keys, admin keys, usage, and audit logs after access changes.

## API Keys and Member Removal

Organization API keys are tied to an organization and, when applicable, to a project and owner.

When a member is removed from an organization:

- Their organization-scoped API keys are disabled.
- Their organization admin keys are revoked.
- Requests using those disabled keys are rejected.
- The organization audit log records the access change.

This keeps billing and access aligned with current organization membership.
