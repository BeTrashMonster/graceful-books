# Capability Spec: Receipt Capture (Basic)

## Overview
The Receipt Capture capability provides basic image upload, storage, and transaction linking for receipts. This foundational feature helps users organize receipt documentation and maintain compliance without manual filing.

## ADDED Requirements


### ACCT-003: Expense Tracking - Receipt Capture (Basic subset)
**Priority:** Critical (Nice for MVP)
**Category:** Accounting

**RECEIPT CAPTURE (Group C - Basic):**
1. Image upload (camera/file)
2. Receipt storage (encrypted)
3. Link receipt to transaction
4. Receipt gallery view
5. Basic metadata (date uploaded, file size)

**FUTURE (Post-Group C):**
- OCR extraction of amount, date, vendor (Group G)
- Auto-matching receipts to transactions (Group G)
- Bulk upload
- Receipt search
- Receipt expiration warnings (for tax purposes)
- Mobile app with quick capture

**ACCEPTANCE CRITERIA:**
- [ ] Upload supports JPEG, PNG, PDF formats
- [ ] Images encrypted at rest
- [ ] Receipt linked to transaction persists across edits
- [ ] Gallery view loads thumbnails quickly (<2 seconds for 100 receipts)
- [ ] Delete receipt removes file and database record

## Data Models

### Receipt
```typescript
interface Receipt {
  id: string;
  companyId: string;

  // File information
  filename: string; // Original filename
  storagePath: string; // Encrypted storage path
  fileType: 'image/jpeg' | 'image/png' | 'application/pdf';
  fileSize: number; // Bytes
  thumbnailPath?: string; // Generated thumbnail

  // Image metadata
  width?: number;
  height?: number;
  orientation?: number; // EXIF orientation

  // Links
  transactionId?: string; // Linked transaction
  transactionIds?: string[]; // Future: multiple transactions per receipt

  // Metadata
  uploadedAt: Date;
  uploadedBy: string; // User ID
  uploadedFrom?: 'web' | 'mobile' | 'email'; // Source

  // Future: OCR data
  ocrData?: ReceiptOCRData;
  ocrProcessed?: boolean;

  // Notes
  notes?: string;

  // Status
  status: 'active' | 'deleted';
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface ReceiptOCRData {
  // For future Group G implementation
  vendor?: string;
  amount?: number;
  currency?: string;
  date?: Date;
  confidence?: number; // 0-1
  rawText?: string;
  processedAt?: Date;
}
```

## API

### Receipt Capture API
```typescript
interface ReceiptCaptureEngine {
  // Upload operations
  uploadReceipt(file: File, metadata?: ReceiptMetadata): Promise<Receipt>;
  uploadMultiple(files: File[]): Promise<Receipt[]>;

  // Retrieval
  getReceipt(receiptId: string): Promise<Receipt>;
  getReceiptFile(receiptId: string): Promise<Blob>;
  getReceiptThumbnail(receiptId: string): Promise<Blob>;
  listReceipts(options?: ListOptions): Promise<ReceiptList>;

  // Transaction linking
  linkToTransaction(
    receiptId: string,
    transactionId: string
  ): Promise<Receipt>;

  unlinkFromTransaction(
    receiptId: string,
    transactionId: string
  ): Promise<Receipt>;

  getReceiptsByTransaction(transactionId: string): Promise<Receipt[]>;

  // Management
  updateReceipt(
    receiptId: string,
    updates: ReceiptUpdate
  ): Promise<Receipt>;

  deleteReceipt(receiptId: string): Promise<void>; // Soft delete

  // Notes
  addNote(receiptId: string, note: string): Promise<Receipt>;
  updateNote(receiptId: string, note: string): Promise<Receipt>;

  // Validation
  validateFile(file: File): ValidationResult;

  // Statistics
  getReceiptStats(): Promise<ReceiptStats>;
}

interface ReceiptMetadata {
  transactionId?: string; // Link immediately on upload
  notes?: string;
  uploadedFrom?: 'web' | 'mobile' | 'email';
}

interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'uploadedAt' | 'filename' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
  filter?: ReceiptFilter;
}

interface ReceiptFilter {
  transactionId?: string; // Receipts for specific transaction
  unlinked?: boolean; // Receipts not linked to any transaction
  uploadedFrom?: Date; // Uploaded after date
  uploadedTo?: Date; // Uploaded before date
  fileType?: string;
}

interface ReceiptList {
  receipts: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface ReceiptUpdate {
  notes?: string;
  transactionId?: string;
}

interface ReceiptStats {
  total: number;
  linked: number;
  unlinked: number;
  totalSize: number; // Total storage used in bytes
  byFileType: Record<string, number>;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  code: string;
  message: string;
}
```

## Business Logic

### File Upload
```typescript
async function uploadReceipt(
  file: File,
  metadata?: ReceiptMetadata
): Promise<Receipt> {
  // Validation
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  // Generate unique filename
  const fileExtension = getFileExtension(file.name);
  const storagePath = generateStoragePath(fileExtension);
  const thumbnailPath = generateThumbnailPath();

  // Read file
  const buffer = await file.arrayBuffer();

  // Encrypt file
  const encryptedBuffer = await encryptFile(buffer);

  // Upload to storage
  await saveToStorage(storagePath, encryptedBuffer);

  // Generate thumbnail (for images only)
  let thumbnail: Buffer | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let orientation: number | undefined;

  if (file.type.startsWith('image/')) {
    const imageInfo = await processImage(buffer);
    width = imageInfo.width;
    height = imageInfo.height;
    orientation = imageInfo.orientation;

    // Generate thumbnail (max 300x300)
    thumbnail = await generateThumbnail(buffer, {
      maxWidth: 300,
      maxHeight: 300,
      quality: 0.8
    });

    const encryptedThumbnail = await encryptFile(thumbnail);
    await saveToStorage(thumbnailPath, encryptedThumbnail);
  }

  // Create receipt record
  const receipt: Receipt = {
    id: generateId(),
    companyId: getCurrentCompanyId(),
    filename: file.name,
    storagePath,
    fileType: file.type as Receipt['fileType'],
    fileSize: file.size,
    thumbnailPath: thumbnail ? thumbnailPath : undefined,
    width,
    height,
    orientation,
    transactionId: metadata?.transactionId,
    uploadedAt: new Date(),
    uploadedBy: getCurrentUserId(),
    uploadedFrom: metadata?.uploadedFrom || 'web',
    notes: metadata?.notes,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Save receipt record
  await saveReceipt(receipt);

  // If linked to transaction, update transaction
  if (receipt.transactionId) {
    await linkReceiptToTransaction(receipt.id, receipt.transactionId);
  }

  // Audit log
  await logAuditEvent({
    type: 'receipt-uploaded',
    entityId: receipt.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      filename: receipt.filename,
      fileSize: receipt.fileSize,
      transactionId: receipt.transactionId
    }
  });

  return receipt;
}
```

### File Validation
```typescript
function validateFile(file: File): ValidationResult {
  const errors: ValidationError[] = [];

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    errors.push({
      code: 'INVALID_FILE_TYPE',
      message: `File type ${file.type} is not supported. Please upload JPEG, PNG, or PDF.`
    });
  }

  // Check file size (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File size exceeds maximum of 10MB. Your file is ${formatFileSize(file.size)}.`
    });
  }

  // Check file name
  if (!file.name || file.name.trim() === '') {
    errors.push({
      code: 'INVALID_FILENAME',
      message: 'File must have a valid filename.'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Transaction Linking
```typescript
async function linkReceiptToTransaction(
  receiptId: string,
  transactionId: string
): Promise<Receipt> {
  const receipt = await getReceipt(receiptId);
  const transaction = await getTransaction(transactionId);

  // Update receipt
  receipt.transactionId = transactionId;
  receipt.updatedAt = new Date();
  await saveReceipt(receipt);

  // Update transaction (add receipt reference)
  if (!transaction.receiptIds) {
    transaction.receiptIds = [];
  }
  if (!transaction.receiptIds.includes(receiptId)) {
    transaction.receiptIds.push(receiptId);
  }
  await saveTransaction(transaction);

  // Audit log
  await logAuditEvent({
    type: 'receipt-linked',
    entityId: receipt.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      transactionId
    }
  });

  return receipt;
}

async function unlinkReceiptFromTransaction(
  receiptId: string,
  transactionId: string
): Promise<Receipt> {
  const receipt = await getReceipt(receiptId);
  const transaction = await getTransaction(transactionId);

  // Update receipt
  receipt.transactionId = undefined;
  receipt.updatedAt = new Date();
  await saveReceipt(receipt);

  // Update transaction (remove receipt reference)
  if (transaction.receiptIds) {
    transaction.receiptIds = transaction.receiptIds.filter(
      id => id !== receiptId
    );
  }
  await saveTransaction(transaction);

  // Audit log
  await logAuditEvent({
    type: 'receipt-unlinked',
    entityId: receipt.id,
    userId: getCurrentUserId(),
    timestamp: new Date(),
    details: {
      transactionId
    }
  });

  return receipt;
}
```

### Image Processing
```typescript
async function processImage(buffer: ArrayBuffer): Promise<ImageInfo> {
  // Use image processing library (e.g., sharp, jimp)
  const image = await loadImage(buffer);

  return {
    width: image.width,
    height: image.height,
    orientation: image.orientation || 1,
    format: image.format
  };
}

async function generateThumbnail(
  buffer: ArrayBuffer,
  options: ThumbnailOptions
): Promise<Buffer> {
  const { maxWidth, maxHeight, quality } = options;

  // Load image
  const image = await loadImage(buffer);

  // Calculate thumbnail dimensions (maintain aspect ratio)
  let width = image.width;
  let height = image.height;

  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  // Resize and compress
  const thumbnail = await image
    .resize(Math.round(width), Math.round(height))
    .jpeg({ quality: quality * 100 })
    .toBuffer();

  return thumbnail;
}
```

### Receipt Deletion
```typescript
async function deleteReceipt(receiptId: string): Promise<void> {
  const receipt = await getReceipt(receiptId);

  // Check if linked to transaction
  if (receipt.transactionId) {
    // Unlink first
    await unlinkReceiptFromTransaction(receiptId, receipt.transactionId);
  }

  // Soft delete
  receipt.status = 'deleted';
  receipt.deletedAt = new Date();
  receipt.updatedAt = new Date();
  await saveReceipt(receipt);

  // Note: Files are kept for audit purposes, can be purged later
  // by a separate cleanup job after retention period

  // Audit log
  await logAuditEvent({
    type: 'receipt-deleted',
    entityId: receipt.id,
    userId: getCurrentUserId(),
    timestamp: new Date()
  });
}
```

## UI Components

### ReceiptUpload
Upload component with drag-and-drop.

**Props:**
- `transactionId?: string` (auto-link on upload)
- `onUploadComplete: (receipts: Receipt[]) => void`
- `multiple?: boolean` (allow multiple files)

**Features:**
- Drag-and-drop zone
- Click to browse file selector
- Progress indicator during upload
- Preview of selected file before upload
- Validation error messages
- Support for camera on mobile devices
- Multiple file upload (future)

### ReceiptGallery
Grid view of all receipts.

**Props:**
- `filter?: ReceiptFilter`
- `onReceiptSelect: (receipt: Receipt) => void`

**Features:**
- Thumbnail grid (responsive columns)
- Lazy loading of thumbnails
- Filename and upload date below thumbnail
- Transaction link indicator (if linked)
- Filter: All / Linked / Unlinked
- Search by filename (future)
- Select mode for bulk actions (future)
- Empty state: "No receipts yet. Upload your first receipt!"

### ReceiptViewer
Full-size receipt viewer.

**Props:**
- `receipt: Receipt`
- `onClose: () => void`
- `onDelete: () => void`
- `onLink: (transactionId: string) => void`

**Features:**
- Full-size image display
- Zoom controls (in/out/fit)
- PDF viewer (for PDF receipts)
- Rotation controls (90° increments)
- Filename and metadata display
- Transaction linking interface
- Notes editor
- Download original file button
- Delete button (with confirmation)
- Navigation to next/previous receipt (when in gallery context)

### ReceiptLink
Transaction linking component.

**Props:**
- `receiptId: string`
- `currentTransactionId?: string`
- `onLink: (transactionId: string) => void`
- `onUnlink: () => void`

**Features:**
- Transaction search/select dropdown
- "Create new transaction from this receipt" button (future with OCR)
- Show currently linked transaction (if any)
- "Unlink" button to remove link
- Recent transactions suggestion

### ReceiptThumbnail
Individual receipt thumbnail card.

**Props:**
- `receipt: Receipt`
- `onClick: () => void`
- `showLink?: boolean`
- `selectable?: boolean`

**Features:**
- Thumbnail image
- File type icon (for PDFs)
- Filename (truncated)
- Upload date
- Linked transaction indicator (checkmark or chain icon)
- Hover actions: View, Delete, Link

## User Experience

### First Receipt Moment
When user uploads first receipt:
- "Receipt saved! That's one less piece of paper to worry about."
- Helpful tooltip: "You can link this receipt to a transaction for easy reference"
- Suggest linking to a recent expense

### Receipt Matching Celebration
When receipt linked to transaction:
- "Perfect match! Receipt and transaction are now best friends."
- Visual connection animation (receipt → transaction)

### Empty States
**No receipts:**
```
No receipts yet
Upload receipt images to keep them organized and accessible.
[+ Upload Receipt]
```

**No unlinked receipts:**
```
All receipts are linked!
Great job keeping your records organized.
```

### Tone & Messaging
- **Encouraging:** "Upload your receipts here to keep them organized"
- **Helpful:** "Link receipts to transactions for easy reference at tax time"
- **Celebratory:** "Receipt saved! One more thing checked off your list"
- **Reassuring:** "Your receipts are encrypted and stored securely"

## Testing Requirements

### Unit Tests
- File validation (type, size, name)
- Image processing (thumbnail generation, orientation)
- Encryption/decryption
- Transaction linking/unlinking
- Soft delete logic

### Integration Tests
- Upload end-to-end (file → storage → database)
- Retrieve and decrypt file
- Link/unlink from transaction
- Delete receipt removes from transaction
- Gallery loads thumbnails correctly

### User Testing
- Upload completes in <5 seconds (for typical photo)
- Thumbnail generation <2 seconds
- Gallery loads 100 receipts in <2 seconds
- Users understand linking concept
- Drag-and-drop works intuitively

## Performance Requirements
- File upload <5 seconds (for 5MB file)
- Thumbnail generation <2 seconds
- Gallery view loads <2 seconds (100 receipts)
- Full image load <3 seconds
- Receipt viewer opens <1 second

## Storage & Encryption
- All files encrypted at rest using AES-256
- File encryption key derived from user's master key
- Thumbnails also encrypted
- Files stored in local IndexedDB (web) or file system (mobile)
- Future: Sync to relay servers (encrypted blobs)

## Accessibility
- Upload zone has clear keyboard-accessible controls
- Screen reader announces upload progress
- Full image viewer has keyboard controls (zoom, rotate, navigate)
- Alt text for receipt images (generated from filename)
- WCAG 2.1 AA compliance

## Data Privacy
- No OCR or processing of receipt content in Group C (comes in Group G)
- Files never leave user's device unencrypted
- Metadata (filename, size, date) is also encrypted
- Audit log tracks all access to receipts

## Mobile Considerations
- Camera capture integration on mobile devices
- Compress images before upload on mobile (preserve original quality)
- Offline upload queue (upload when connection restored)
- Touch-friendly gallery and viewer

## Future Enhancements (Post-Group C)
- OCR extraction (Group G: amount, date, vendor)
- Auto-matching to transactions (Group G)
- Bulk upload (drag multiple files)
- Receipt search by content/vendor
- Email forwarding address (email receipts to this address)
- Receipt expiration warnings (for tax retention)
- Export all receipts (ZIP file)
- Mobile app with quick capture widget
- Receipt categories/tags
- Duplicate receipt detection
- Receipt templates (for recurring vendors)
