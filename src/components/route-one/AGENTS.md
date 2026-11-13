# Route One components

- Route One booking search opens the read-only SiteContainersDialog, which reuses currentSiteContainers (the Live Jobs/Site History replay, clamped per Skiptrak site name like Live Jobs and listed per bin position with its last real movement) and only prefills the form; Book exchange goes through the existing previous-job applyPrevious path so imported pricing and exchange dates stay on one rule set.
- Previous artic (trailer) jobs are grouped by previousArticJobs in SiteContainersDialog and the previous-jobs list offers Duplicate (same job type, falling back to exchange when that type is switched off in Setup) or Exchange; both only prefill via applyPrevious, never save.
