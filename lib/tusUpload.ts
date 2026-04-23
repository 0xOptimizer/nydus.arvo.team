import * as tus from "tus-js-client";

export type UploadStatus =
| "idle"
| "uploading"
| "paused"
| "complete"
| "error"
| "cancelled";

export interface UploadMetadata {
    filename: string;
    filetype: string;
    upload_type: string;
    [key: string]: string;
}

export interface UploadCallbacks {
    onProgress?: (sent: number, total: number, fraction: number) => void;
    onStatusChange?: (status: UploadStatus) => void;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export interface UploadController {
    pause: () => Promise<void>;
    resume: () => void;
    abort: () => Promise<void>;
    getStatus: () => UploadStatus;
}

const ENDPOINT = "/tusd/uploads/";
const RETRY_DELAYS = [5000, 15000, 45000];

function sanitizeMetaValue(value: string): string {
    return value.replace(/[,\n\r]/g, " ").trim();
}

function chunkSizeForFile(fileSize: number): number {
    if (fileSize < 10 * 1024 * 1024) return 1 * 1024 * 1024;
    if (fileSize < 100 * 1024 * 1024) return 5 * 1024 * 1024;
    if (fileSize < 1024 * 1024 * 1024) return 10 * 1024 * 1024;
    return 50 * 1024 * 1024;
}

function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === "object" && err !== null && "message" in err) {
        return new Error(String((err as { message: unknown }).message));
    }
    return new Error(String(err));
}

export function startUpload(
    file: File,
    metadata: UploadMetadata,
    callbacks: UploadCallbacks = {}
): UploadController {
    if (!file) throw new Error("File is required");
    if (file.size === 0) throw new Error("File must not be empty");
    if (!metadata.filename) throw new Error("Metadata must include filename");
    if (!metadata.filetype) throw new Error("Metadata must include filetype");
    if (!metadata.upload_type) throw new Error("Metadata must include upload_type");
    
    const rawMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
        rawMeta[k] = sanitizeMetaValue(String(v));
    }
    
    let status: UploadStatus = "idle";
    let suppressError = false;
    
    const setStatus = (next: UploadStatus) => {
        if (status === next) return;
        status = next;
        callbacks.onStatusChange?.(next);
    };
    
    const upload = new tus.Upload(file, {
        endpoint: ENDPOINT,
        retryDelays: RETRY_DELAYS,
        metadata: rawMeta,
        chunkSize: chunkSizeForFile(file.size),
        removeFingerprintOnSuccess: true,
        onProgress(bytesSent, bytesTotal) {
            if (!bytesTotal) return;
            callbacks.onProgress?.(bytesSent, bytesTotal, bytesSent / bytesTotal);
        },
        onSuccess() {
            setStatus("complete");
            callbacks.onSuccess?.();
        },
        onError(err) {
            if (suppressError) return;
            setStatus("error");
            callbacks.onError?.(normalizeError(err));
        },
    });
    
    upload
    .findPreviousUploads()
    .then((previous) => {
        if (status === "cancelled") return;
        
        if (previous.length > 0) {
            const best = previous.reduce((a, b) => {
                const aTime = a.creationTime ? new Date(a.creationTime).getTime() : 0;
                const bTime = b.creationTime ? new Date(b.creationTime).getTime() : 0;
                return bTime > aTime ? b : a;
            });
            upload.resumeFromPreviousUpload(best);
        }
        
        setStatus("uploading");
        upload.start();
    })
    .catch((err) => {
        setStatus("error");
        callbacks.onError?.(normalizeError(err));
    });
    
    return {
        async pause() {
            if (status !== "uploading") return;
            suppressError = true;
            setStatus("paused");
            try {
                await upload.abort(false);
            } finally {
                suppressError = false;
            }
        },
        
        resume() {
            if (status !== "paused") return;
            setStatus("uploading");
            upload.start();
        },
        
        async abort() {
            if (
                status === "complete" ||
                status === "cancelled" ||
                status === "error"
            ) return;
            
            suppressError = true;
            try {
                await upload.abort(true);
            } finally {
                suppressError = false;
                setStatus("cancelled");
            }
        },
        
        getStatus() {
            return status;
        },
    };
}