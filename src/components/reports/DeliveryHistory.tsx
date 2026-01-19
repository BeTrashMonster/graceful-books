/**
 * Delivery History Component
 *
 * Per I6: Scheduled Report Delivery
 * Displays delivery history for scheduled reports with status tracking.
 */

import { useMemo } from 'react';
import type { ScheduledReportDelivery } from '../../types/scheduledReports.types';
import { format } from 'date-fns';

export interface DeliveryHistoryProps {
  deliveries: ScheduledReportDelivery[];
  isLoading?: boolean;
  onRetry?: (deliveryId: string) => Promise<void>;
}

export function DeliveryHistory({ deliveries, isLoading, onRetry }: DeliveryHistoryProps) {
  const sortedDeliveries = useMemo(() => {
    return [...deliveries].sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }, [deliveries]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No deliveries yet</p>
        <p className="text-sm mt-2">When reports are delivered, they'll appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedDeliveries.map((delivery) => (
        <DeliveryCard key={delivery.id} delivery={delivery} onRetry={onRetry} />
      ))}
    </div>
  );
}

function DeliveryCard({
  delivery,
  onRetry,
}: {
  delivery: ScheduledReportDelivery;
  onRetry?: (deliveryId: string) => Promise<void>;
}) {
  const getStatusBadge = () => {
    const classes = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (delivery.status) {
      case 'sent':
        return <span className={`${classes} bg-green-100 text-green-800`}>Sent</span>;
      case 'failed':
        return <span className={`${classes} bg-red-100 text-red-800`}>Failed</span>;
      case 'pending':
        return <span className={`${classes} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'processing':
        return <span className={`${classes} bg-blue-100 text-blue-800`}>Processing</span>;
      case 'retrying':
        return <span className={`${classes} bg-orange-100 text-orange-800`}>Retrying</span>;
      default:
        return <span className={`${classes} bg-gray-100 text-gray-800`}>{delivery.status}</span>;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-medium text-gray-900">{delivery.reportName}</h4>
            {getStatusBadge()}
          </div>

          <div className="mt-2 text-sm text-gray-600 space-y-1">
            <p>
              <span className="font-medium">Scheduled:</span>{' '}
              {format(delivery.scheduledAt, 'PPp')}
            </p>
            {delivery.sentAt && (
              <p>
                <span className="font-medium">Sent:</span> {format(delivery.sentAt, 'PPp')}
              </p>
            )}
            <p>
              <span className="font-medium">Recipients:</span> {delivery.recipients.join(', ')}
            </p>
            <p>
              <span className="font-medium">Format:</span> {delivery.format.toUpperCase()}
            </p>
            {delivery.attachmentSize && (
              <p>
                <span className="font-medium">Size:</span>{' '}
                {formatBytes(delivery.attachmentSize)}
              </p>
            )}
          </div>

          {delivery.failureReason && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              <strong>Error:</strong> {delivery.failureReason}
            </div>
          )}
        </div>

        {delivery.status === 'failed' && onRetry && delivery.retryCount < delivery.maxRetries && (
          <button
            onClick={() => onRetry(delivery.id)}
            className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        )}
      </div>

      {delivery.retryCount > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Retry attempts: {delivery.retryCount} / {delivery.maxRetries}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
