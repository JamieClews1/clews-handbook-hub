import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Only allows safe HTML tags for rich text content.
 */
export const sanitizeHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i',
      'u', 's', 'br', 'hr', 'span', 'div', 'blockquote', 'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'src', 'alt', 'colspan', 'rowspan'],
  });

};
