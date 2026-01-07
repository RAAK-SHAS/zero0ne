// CORS configuration with origin validation
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://lovable.dev',
  'https://preview--ttrbjdpiccvfaccwpodu.lovable.app',
  'https://ttrbjdpiccvfaccwpodu.lovable.app'
];

// Wildcard CORS for public endpoints (like get-shared-file)
export const wildcardCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Restricted CORS for authenticated endpoints
export const getRestrictedCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get('origin');
  
  // Check if origin is in allowed list or matches lovable.app pattern
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovable.dev')
  );
  
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
  
  // Default to first allowed origin if origin not provided or not allowed
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
};

// Validate origin and log suspicious requests
export const validateOrigin = (req: Request): boolean => {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  
  const isAllowed = ALLOWED_ORIGINS.some(allowed => 
    origin?.startsWith(allowed) || referer?.startsWith(allowed)
  ) || origin?.endsWith('.lovable.app') || origin?.endsWith('.lovable.dev');
  
  if (!isAllowed && origin) {
    console.warn('Request from non-allowed origin:', {
      origin,
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent')?.substring(0, 100)
    });
  }
  
  return isAllowed ?? false;
};
