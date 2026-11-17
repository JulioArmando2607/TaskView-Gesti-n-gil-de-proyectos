import TvApiBase from './base'
import type { AppResponse } from './base.types'
import type { ScrumReportFilters, ScrumReportsOverview } from './scrum-reports.types'

export default class TvScrumReportsApi extends TvApiBase {
  protected moduleUrl = '/module/scrum/reports'

  public overview(filters: ScrumReportFilters) {
    const { goalId, ...query } = filters
    return this.request(this.$axios.get<AppResponse<ScrumReportsOverview>>(`${this.moduleUrl}/${goalId}/overview`, { params: query }))
  }

  public export(filters: ScrumReportFilters & { format: 'csv' | 'xlsx' }) {
    const { goalId, ...query } = filters
    return this.$axios.get(`${this.moduleUrl}/${goalId}/export`, { params: query, responseType: 'blob' })
  }
}
