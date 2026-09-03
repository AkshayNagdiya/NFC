import { useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
import { inr } from '../../lib/format';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Select, TableSkeleton, useConfirm } from '../../components/ui';
import { txnUserName, useRefund, useTransactions } from '../wallet/walletApi';

export function TransactionsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const canRefund = hasPerm('transactions.manage');
  const { ask, dialog } = useConfirm();
  const refund = useRefund();

  const query = useTransactions({ page, type: type || undefined, status: status || undefined });

  async function doRefund(id: string): Promise<void> {
    if (!(await ask({ title: 'Refund this debit?', body: 'A REFUND ledger row restores the balance. The original row is never modified.', danger: true }))) return;
    refund.mutate({ transactionId: id, reason: 'Refunded from transactions console' });
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Transactions" subtitle="Immutable financial ledger. Reversals are new REFUND rows." />
      <div className="flex flex-wrap gap-2">
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type">
          <option value="">All types</option>
          {['CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT'].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {['SUCCESS', 'PENDING', 'FAILED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {query.isPending && <TableSkeleton cols={6} />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState title="No transactions" body="Wallet credits, debits, refunds, and adjustments will appear here." />
      )}
      {query.data && query.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Amount</th><th className="px-4 py-2.5">Balance after</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Date</th>{canRefund && <th className="px-4 py-2.5">Actions</th>}</tr>
            </thead>
            <tbody>
              {query.data.items.map((t) => (
                <tr key={t._id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium">{txnUserName(t)}</td>
                  <td className="px-4 py-2.5"><Badge value={t.type} /></td>
                  <td className={`px-4 py-2.5 font-medium ${t.type === 'DEBIT' ? 'text-red-600' : 'text-green-700'}`}>
                    {t.type === 'DEBIT' ? '−' : '+'}{inr(t.amountMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{inr(t.balanceAfterMinor)}</td>
                  <td className="px-4 py-2.5"><Badge value={t.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(t.createdAt), 'PP p')}</td>
                  {canRefund && (
                    <td className="px-4 py-2.5">
                      {t.type === 'DEBIT' && t.status === 'SUCCESS' && (
                        <Button variant="secondary" disabled={refund.isPending} onClick={() => doRefund(t._id)}>Refund</Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} onPage={setPage} />}
      {dialog}
    </div>
  );
}
