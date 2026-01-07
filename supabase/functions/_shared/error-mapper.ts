// Centralized error handling to prevent information leakage
export type ErrorCategory = 
  | 'auth'
  | 'notfound'
  | 'validation'
  | 'ratelimit'
  | 'internal';

export interface SafeError {
  message: string;
  status: number;
  category: ErrorCategory;
}

const ERROR_MESSAGES: Record<ErrorCategory, SafeError> = {
  auth: {
    message: 'Authentication required or invalid',
    status: 401,
    category: 'auth'
  },
  notfound: {
    message: 'Requested resource not found',
    status: 404,
    category: 'notfound'
  },
  validation: {
    message: 'Invalid request parameters',
    status: 400,
    category: 'validation'
  },
  ratelimit: {
    message: 'Too many requests, please try again later',
    status: 429,
    category: 'ratelimit'
  },
  internal: {
    message: 'An error occurred processing your request',
    status: 500,
    category: 'internal'
  }
};

export const mapError = (error: unknown): SafeError => {
  // Log full error server-side for debugging
  console.error('Internal error details:', error);
  
  // Categorize error based on message content
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('token')) {
      return ERROR_MESSAGES.auth;
    }
    if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('no rows')) {
      return ERROR_MESSAGES.notfound;
    }
    if (msg.includes('invalid') || msg.includes('validation') || msg.includes('required')) {
      return ERROR_MESSAGES.validation;
    }
    if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
      return ERROR_MESSAGES.ratelimit;
    }
  }
  
  // Default to internal error - never expose raw messages
  return ERROR_MESSAGES.internal;
};

export const createErrorResponse = (error: unknown, corsHeaders: Record<string, string>) => {
  const safeError = mapError(error);
  return new Response(
    JSON.stringify({ 
      error: safeError.message,
      category: safeError.category
    }),
    { 
      status: safeError.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};

// Security logging helper
export const logSecurityEvent = (event: string, details: Record<string, unknown>) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    severity: 'security',
    ...details
  }));
};
