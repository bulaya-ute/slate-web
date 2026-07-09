import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { StorageBar } from './StorageBar'
import { useAdminStatsQuery } from './useAdmin'

export function StoragePage() {
  const { data, isLoading, isError, refetch } = useAdminStatsQuery()

  const maxUserBytes = Math.max(0, ...(data?.users.map((u) => u.sizeBytes) ?? [0]))
  const maxVaultBytes = Math.max(0, ...(data?.vaults.map((v) => v.sizeBytes) ?? [0]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[16px] font-semibold text-text">Storage</h1>
        <p className="text-[12px] text-text-faint">Disk usage by user and by vault.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading storage stats">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] text-danger">Couldn&apos;t load storage stats.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-text">By user</h2>
            {data && data.users.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.users
                  .slice()
                  .sort((a, b) => b.sizeBytes - a.sizeBytes)
                  .map((u) => (
                    <StorageBar
                      key={u.userId}
                      label={u.displayName}
                      sizeBytes={u.sizeBytes}
                      maxBytes={maxUserBytes}
                      secondary={u.noteCount !== undefined ? `${u.noteCount} notes` : undefined}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-[12px] text-text-faint">No usage data yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-text">By vault</h2>
            {data && data.vaults.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.vaults
                  .slice()
                  .sort((a, b) => b.sizeBytes - a.sizeBytes)
                  .map((v) => (
                    <StorageBar
                      key={v.vaultId}
                      label={v.name}
                      sizeBytes={v.sizeBytes}
                      maxBytes={maxVaultBytes}
                      secondary={v.noteCount !== undefined ? `${v.noteCount} notes` : undefined}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-[12px] text-text-faint">No usage data yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
