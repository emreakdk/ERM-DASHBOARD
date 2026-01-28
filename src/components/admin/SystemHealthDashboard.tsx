import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, XCircle, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface SystemError {
  id: string
  error_code: string
  error_message: string
  error_source: string | null
  request_path: string | null
  user_id: string | null
  metadata: Record<string, any> | null
  created_at: string
}

async function fetchSystemErrors(limit = 50): Promise<SystemError[]> {
  const { data, error } = await supabase
    .from('system_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as SystemError[]
}

function getErrorCodeColor(code: string) {
  if (code.startsWith('5')) return 'bg-red-500/10 text-red-300 border-red-500/30'
  if (code.startsWith('4')) return 'bg-orange-500/10 text-orange-300 border-orange-500/30'
  if (code.startsWith('3')) return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
  return 'bg-gray-500/10 text-gray-300 border-gray-500/30'
}

function getErrorIcon(code: string) {
  if (code.startsWith('5')) return <XCircle className="h-4 w-4 text-red-400" />
  if (code.startsWith('4')) return <AlertCircle className="h-4 w-4 text-orange-400" />
  return <CheckCircle2 className="h-4 w-4 text-gray-400" />
}

export function SystemHealthDashboard() {
  const [errorCodeFilter, setErrorCodeFilter] = useState<string>('all')

  const errorsQuery = useQuery({
    queryKey: ['system_errors', errorCodeFilter],
    queryFn: () => fetchSystemErrors(50),
  })

  const filteredErrors = errorsQuery.data?.filter((error) => {
    if (errorCodeFilter === 'all') return true
    if (errorCodeFilter === '5xx') return error.error_code.startsWith('5')
    if (errorCodeFilter === '4xx') return error.error_code.startsWith('4')
    if (errorCodeFilter === '3xx') return error.error_code.startsWith('3')
    return true
  })

  const errorStats = {
    total: errorsQuery.data?.length || 0,
    serverErrors: errorsQuery.data?.filter((e) => e.error_code.startsWith('5')).length || 0,
    clientErrors: errorsQuery.data?.filter((e) => e.error_code.startsWith('4')).length || 0,
    redirects: errorsQuery.data?.filter((e) => e.error_code.startsWith('3')).length || 0,
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Hata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sunucu Hataları (5xx)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{errorStats.serverErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              İstemci Hataları (4xx)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{errorStats.clientErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Yönlendirmeler (3xx)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{errorStats.redirects}</div>
          </CardContent>
        </Card>
      </div>

      {/* Error List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Sistem Hataları
              </CardTitle>
              <CardDescription className="mt-1">
                Son 50 sistem hatası ve API yanıtları
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={errorCodeFilter} onValueChange={setErrorCodeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="5xx">5xx Hataları</SelectItem>
                  <SelectItem value="4xx">4xx Hataları</SelectItem>
                  <SelectItem value="3xx">3xx Yönlendirme</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errorsQuery.isLoading ? (
              <div className="text-center text-muted-foreground py-8">Yükleniyor...</div>
            ) : filteredErrors && filteredErrors.length > 0 ? (
              filteredErrors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {getErrorIcon(error.error_code)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono ${getErrorCodeColor(error.error_code)}`}
                          >
                            {error.error_code}
                          </Badge>
                          {error.error_source && (
                            <Badge variant="outline" className="text-xs">
                              {error.error_source}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-foreground">{error.error_message}</p>
                        {error.request_path && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {error.request_path}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(error.created_at), 'dd MMM HH:mm', { locale: tr })}
                      </span>
                    </div>
                    {error.metadata && Object.keys(error.metadata).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Detaylar
                        </summary>
                        <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto">
                          {JSON.stringify(error.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {errorCodeFilter === 'all'
                  ? 'Henüz sistem hatası kaydedilmedi'
                  : 'Bu filtre için hata bulunamadı'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
