import React, { useState, useCallback } from 'react';

const DocumentUploader = ({ onFilesUploaded, error: externalError }) => {
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file (reduced to prevent memory issues)
  const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total (reduced to prevent memory issues)
  const ALLOWED_TYPES = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  const validateFiles = (fileList) => {
    const fileArray = Array.from(fileList);
    let totalSize = files.reduce((sum, file) => sum + file.size, 0);

    for (const file of fileArray) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File "${file.name}" is too large. Maximum size is 5MB.`);
      }

      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`File type "${file.type}" is not supported. Supported types: PDF, Word documents, text files, and images.`);
      }

      totalSize += file.size;
    }

    // Check total size
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error(`Total file size exceeds 20MB limit.`);
    }

    return fileArray;
  };

  const handleFileSelect = useCallback(async (selectedFiles) => {
    try {
      setError('');
      const validatedFiles = validateFiles(selectedFiles);

      const newFiles = await Promise.all(validatedFiles.map(async (file) => {
        // Convert file to base64 for JSON serialization
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        return {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending', // pending, uploading, completed, error
          base64Data: base64Data
        };
      }));

      setFiles(prev => [...prev, ...newFiles]);
      onFilesUploaded && onFilesUploaded([...files, ...newFiles]);
    } catch (err) {
      setError(err.message);
    }
  }, [files, onFilesUploaded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      handleFileSelect(selectedFiles);
    }
  }, [handleFileSelect]);

  const removeFile = (fileId) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesUploaded && onFilesUploaded(updatedFiles);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📋';
    if (fileType.includes('image')) return '🖼️';
    return '📁';
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalSizeFormatted = formatFileSize(totalSize);
  const isOverLimit = totalSize > MAX_TOTAL_SIZE;

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragOver
            ? 'border-accent bg-accent/10'
            : 'border-secondary hover:border-accent/50'
          }
          ${isOverLimit ? 'border-red-500 bg-red-50' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">📁</div>
          <div>
            <p className="text-text font-bold">
              Drag and drop files here, or{' '}
              <label className="text-accent hover:text-accent/80 cursor-pointer underline">
                browse files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx,.doc,.jpg,.jpeg,.png,.gif"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-text text-sm mt-1">
              Supported: PDF, Word docs, text files, images (Max 5MB per file, 20MB total)
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(error || externalError) && (
        <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error || externalError}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-text font-medium">
              Uploaded Files ({files.length})
            </h4>
            <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-text/70'}`}>
              {totalSizeFormatted} / 20MB
            </span>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className="flex items-center justify-between p-3 bg-primary rounded-lg border border-secondary/20"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg">{getFileIcon(fileItem.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium truncate">
                      {fileItem.name}
                    </p>
                    <p className="text-text/70 text-sm">
                      {formatFileSize(fileItem.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {fileItem.status === 'pending' && (
                    <span className="text-yellow-600 text-sm">Pending</span>
                  )}
                  {fileItem.status === 'uploading' && (
                    <span className="text-blue-600 text-sm">Uploading...</span>
                  )}
                  {fileItem.status === 'completed' && (
                    <span className="text-green-600 text-sm">✓ Done</span>
                  )}
                  {fileItem.status === 'error' && (
                    <span className="text-red-600 text-sm">✗ Error</span>
                  )}

                  <button
                    onClick={() => removeFile(fileItem.id)}
                    className="text-text/70 hover:text-red-500 p-1 rounded"
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Info */}
      {files.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <p className="font-medium">📚 About your documents:</p>
          <ul className="mt-1 text-xs space-y-1">
            <li>• Documents will be processed to help your companion understand your memories</li>
            <li>• Text will be extracted and used to provide personalized responses</li>
            <li>• Processing happens after companion creation and may take a few minutes</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;