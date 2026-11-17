import { useI18n } from 'vue-i18n'

const detailKeys: Record<string, string> = {
  acceptance_criteria_missing: 'tasks.doneBlockedReasons.acceptanceCriteria',
  qa_not_approved: 'tasks.doneBlockedReasons.qaNotApproved',
  qa_observations_pending: 'tasks.doneBlockedReasons.qaObservations',
  blocking_bugs_open: 'tasks.doneBlockedReasons.blockingBugs',
  functional_acceptance_missing: 'tasks.doneBlockedReasons.functionalAcceptance',
}

export function useDefinitionOfDoneMessage() {
  const { t } = useI18n()

  return (details?: string[]) => {
    const reasons = (details ?? [])
      .map(detail => detailKeys[detail])
      .filter((key): key is string => Boolean(key))
      .map(key => t(key))

    return reasons.length > 0
      ? reasons.join(' ')
      : t('tasks.doneBlockedDescription')
  }
}
