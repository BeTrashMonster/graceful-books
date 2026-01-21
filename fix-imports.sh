#!/bin/bash

# Fix comments.service.test.ts - add TransactionType, TransactionStatus
file="src/services/comments.service.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  TransactionType,\n  TransactionStatus\n} from/' "$file"
else
  sed -i "1a import { TransactionType, TransactionStatus } from '../types/database.types';" "$file"
fi

# Fix conflictResolution.service.test.ts - add AccountType
file="src/services/conflictResolution.service.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  AccountType\n} from/' "$file"
else
  sed -i "1a import { AccountType } from '../types/database.types';" "$file"
fi

# Fix entityMergeStrategies.test.ts - add AccountType, TransactionType, TransactionStatus
file="src/services/crdt/entityMergeStrategies.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  AccountType,\n  TransactionType,\n  TransactionStatus\n} from/' "$file"
else
  sed -i "1a import { AccountType, TransactionType, TransactionStatus } from '../../types/database.types';" "$file"
fi

# Fix duplicateDetection.service.test.ts - add ContactType, ContactAccountType
file="src/services/duplicateDetection.service.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  ContactType,\n  ContactAccountType\n} from/' "$file"
else
  sed -i "1a import { ContactType, ContactAccountType } from '../types/database.types';" "$file"
fi

# Fix liabilityDetection.service.test.ts - add TransactionType, TransactionStatus, AccountType
file="src/services/interestSplit/liabilityDetection.service.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  TransactionType,\n  TransactionStatus,\n  AccountType\n} from/' "$file"
else
  sed -i "1a import { TransactionType, TransactionStatus, AccountType } from '../../types/database.types';" "$file"
fi

# Fix journalEntries.integration.test.ts - add JournalEntryApprovalStatus
file="src/services/journalEntries.integration.test.ts"
if grep -q "import.*journalEntry\.types" "$file"; then
  sed -i '/import.*journalEntry\.types/s/} from/,\n  JournalEntryApprovalStatus\n} from/' "$file"
else
  sed -i "1a import { JournalEntryApprovalStatus } from '../types/journalEntry.types';" "$file"
fi

# Fix journalEntries.service.test.ts - add JournalEntryApprovalStatus
file="src/services/journalEntries.service.test.ts"
if grep -q "import.*journalEntry\.types" "$file"; then
  sed -i '/import.*journalEntry\.types/s/} from/,\n  JournalEntryApprovalStatus\n} from/' "$file"
else
  sed -i "1a import { JournalEntryApprovalStatus } from '../types/journalEntry.types';" "$file"
fi

# Fix recentActivity.service.test.ts - add RecentActivityType
file="src/services/recentActivity.service.test.ts"
if grep -q "import.*recentActivity\.types" "$file"; then
  sed -i '/import.*recentActivity\.types/s/} from/,\n  RecentActivityType\n} from/' "$file"
else
  sed -i "1a import { RecentActivityType } from '../types/recentActivity.types';" "$file"
fi

# Fix reconciliationService.additional.test.ts - add MatchConfidence
file="src/services/reconciliationService.additional.test.ts"
if grep -q "import.*reconciliation\.types" "$file"; then
  sed -i '/import.*reconciliation\.types/s/} from/,\n  MatchConfidence\n} from/' "$file"
else
  sed -i "1a import { MatchConfidence } from '../types/reconciliation.types';" "$file"
fi

# Fix reconciliationService.test.ts - add MatchConfidence
file="src/services/reconciliationService.test.ts"
if grep -q "import.*reconciliation\.types" "$file"; then
  sed -i '/import.*reconciliation\.types/s/} from/,\n  MatchConfidence\n} from/' "$file"
else
  sed -i "1a import { MatchConfidence } from '../types/reconciliation.types';" "$file"
fi

# Fix recurrence.service.test.ts - add RecurrenceFrequency, RecurrenceEndType
file="src/services/recurrence.service.test.ts"
if grep -q "import.*database\.types" "$file"; then
  sed -i '/import.*database\.types/s/} from/,\n  RecurrenceFrequency,\n  RecurrenceEndType\n} from/' "$file"
else
  sed -i "1a import { RecurrenceFrequency, RecurrenceEndType } from '../types/database.types';" "$file"
fi

echo "Import fixes applied!"
