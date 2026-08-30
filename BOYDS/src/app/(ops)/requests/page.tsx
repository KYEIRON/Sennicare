import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import {
  listCustomers,
  listJobRequests,
  listJobTypes,
  listNotifications,
} from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { formatOperatingDate, formatOperatingTime } from '@/lib/datetime';
import { RequestActions } from './request-actions';

export const metadata: Metadata = { title: 'Requests' };

/**
 * Incoming requests, and what needs attention.
 *
 * A request is an enquiry, not work BOYD'S has agreed to. Nothing here is
 * scheduled, priced or assigned until a partner decides.
 */
export default async function RequestsPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [requestsResult, notificationsResult, typesResult, customersResult] =
    await Promise.all([
      listJobRequests(supabase),
      listNotifications(supabase, { limit: 30 }),
      listJobTypes(supabase),
      listCustomers(supabase),
    ]);

  const requests = requestsResult.ok ? requestsResult.value : [];
  const notifications = notificationsResult.ok ? notificationsResult.value : [];
  const jobTypes = typesResult.ok ? typesResult.value : [];
  const customers = customersResult.ok ? customersResult.value : [];

  // A request someone has claimed is still waiting on a decision, so it stays
  // on the list rather than vanishing the moment a partner opens it.
  const awaitingReview = requests.filter(
    (request) => request.status === 'NEW' || request.status === 'UNDER_REVIEW',
  );
  const afterHours = awaitingReview.filter((request) => request.isAfterHours);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel title={`Awaiting review (${awaitingReview.length})`}>
          {awaitingReview.length === 0 ? (
            <EmptyState>No requests are waiting.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {awaitingReview.map((request) => (
                <li
                  key={request.id}
                  className={`rounded border p-4 ${
                    request.urgency === 'URGENT' || request.urgency === 'CRITICAL'
                      ? 'border-boyd-negative/40 bg-boyd-negative/5'
                      : request.isAfterHours
                        ? 'border-boyd-warning/30 bg-boyd-warning/5'
                        : 'border-boyd-navy-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="figure font-semibold text-boyd-light-100">
                        {request.requestNumber}
                      </span>
                      <span className="text-sm text-boyd-light-300">
                        {request.companyName ?? request.contactName ?? 'A customer'}
                      </span>
                      {request.status === 'UNDER_REVIEW' && (
                        <span className="rounded bg-boyd-blue-600/20 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-200">
                          BEING REVIEWED
                        </span>
                      )}
                      {request.isAfterHours && (
                        <span className="rounded bg-boyd-warning/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-warning">
                          AFTER HOURS
                        </span>
                      )}
                      {request.urgency && (
                        <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                          {request.urgency}
                        </span>
                      )}
                      {request.isRecurring && (
                        <span className="rounded bg-boyd-orange-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-orange-400">
                          RECURRING
                        </span>
                      )}
                    </div>
                    <span className="figure text-xs text-boyd-light-400">
                      {formatOperatingTime(new Date(request.receivedAt))}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-boyd-light-400">Collection</dt>
                      <dd className="text-boyd-light-200">
                        {request.pickupAddress ?? '—'}
                        {request.pickupCity ? `, ${request.pickupCity}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-boyd-light-400">Delivery</dt>
                      <dd className="text-boyd-light-200">
                        {request.deliveryAddress ?? '—'}
                        {request.deliveryCity ? `, ${request.deliveryCity}` : ''}
                      </dd>
                    </div>
                  </dl>

                  {request.description && (
                    <p className="mt-2 text-sm text-boyd-light-400">
                      {request.description}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-boyd-light-400">
                    {request.contactName}
                    {request.contactPhone ? ` · ${request.contactPhone}` : ''}
                    {request.contactEmail ? ` · ${request.contactEmail}` : ''}
                  </p>

                  <p className="mt-3 text-xs text-boyd-light-500">
                    Nothing has been quoted, scheduled or confirmed. Contact the customer,
                    then create a quote or a job.
                  </p>

                  <RequestActions
                    requestId={request.id}
                    jobTypes={jobTypes}
                    customers={customers}
                    addresses={request}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {afterHours.length > 0 && (
          <Panel title="Arrived out of hours">
            <p className="text-sm text-boyd-light-400">
              {afterHours.length} request{afterHours.length === 1 ? '' : 's'} came in
              outside working hours. The customer has been told it was received and will
              be reviewed — nothing more.
            </p>
          </Panel>
        )}
      </div>

      <Panel title="Recent activity">
        {notifications.length === 0 ? (
          <EmptyState>Nothing yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`rounded border p-3 text-sm ${
                  notification.severity === 'URGENT'
                    ? 'border-boyd-negative/30 bg-boyd-negative/5'
                    : notification.severity === 'ATTENTION'
                      ? 'border-boyd-warning/30 bg-boyd-warning/5'
                      : 'border-boyd-navy-700'
                }`}
              >
                <p className="font-semibold text-boyd-light-100">{notification.title}</p>
                {notification.body && (
                  <p className="mt-1 text-xs text-boyd-light-400">{notification.body}</p>
                )}
                <p className="mt-1 text-xs text-boyd-light-500">
                  {formatOperatingDate(new Date(notification.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
