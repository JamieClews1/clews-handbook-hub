# CRM upgrade: mini Zendesk with customer folders

Today the inbox is a flat list of email threads. This turns it into a customer-centric help desk where every email lives under the account it belongs to.

## 1. Link tickets to customers automatically
- Add a customer link to each ticket, plus the site it relates to when we can work it out.
- On sync, match the sender's email domain against known customer contacts and finance contacts; if no match, try the company name in the signature/subject.
- Unmatched threads land in an "Unassigned" bucket with a one-click "Link to customer" picker (searchable, with a "create contact" shortcut so the next email auto-matches).

## 2. Customer folders view
- New left-hand pane: Customers (with unread counts) → threads for that customer.
- Toggle between "All mail" (current inbox) and "By customer" (folder view).
- Per-customer header showing account code, sites, open tickets, last contact date, and links through to their jobs, rebates, PODs and invoices already in the portal.

## 3. Ticket workflow
- Priority (low/normal/high/urgent) and category (booking, query, complaint, invoice, rebate, other).
- Due/follow-up date with an overdue highlight, plus snooze.
- Internal notes on a thread that are never emailed out.
- Full status flow: new → open → pending customer → resolved → closed, with quick filters and a "my tickets" view.

## 4. Attachments and documents
- Pull email attachments through from Outlook into storage and show them on the thread.
- Show related documents already in the system for that customer/job (POD, WTN ticket, rebate report) so staff can attach them to a reply in one click.

## 5. Productivity
- Canned replies from the existing email templates, insertable into the reply box with placeholders filled in.
- Reply with signature, and CC/BCC support.
- Search across subject, body, sender and customer.
- Bulk actions: assign, status change, close.

## 6. Reporting
- Small dashboard: volume by day, open vs closed, average first-response time, tickets by customer, tickets by assignee.

## Technical notes
- New columns on `crm_tickets`: `customer_id`, `site_id`, `priority`, `category`, `due_at`, `snoozed_until`.
- New tables: `crm_ticket_notes` (internal notes), `crm_ticket_attachments` (Graph attachment metadata + storage path).
- Matching helper resolves sender email/domain against `customer_contacts`, `customer_finance_details` and `customers`, run inside `crm-mailbox-sync` on import and re-runnable on demand for old tickets.
- `CRMPage.tsx` split into `CustomerFolderList`, `TicketList`, `TicketDetail` components to keep it manageable.

## Suggested order
1. Customer linking + folders view (the core of the ask)
2. Attachments
3. Workflow fields, internal notes, canned replies
4. Reporting dashboard
