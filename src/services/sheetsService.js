import { getArea } from '../data/areas';
import { renderAnnotatedImage } from '../utils/imageUtils';

const SCRIPT_URL = process.env.REACT_APP_APPS_SCRIPT_URL;

function assertUploadConfigured() {
  if (!SCRIPT_URL) {
    throw new Error('Drive upload is not configured. Missing REACT_APP_APPS_SCRIPT_URL in the deployed build.');
  }

  if (SCRIPT_URL.includes('/a/macros/')) {
    throw new Error('Drive upload is using a restricted Apps Script URL. Use the public /macros/s/.../exec deployment URL.');
  }
}

/**
 * Submit a completed audit to Google Sheets + Drive via Apps Script.
 * @param {object} audit  — full audit object from AuditContext
 * @param {object} meta   — { totalPhotos, totalAnnotations, areasSummary, commentsSummary }
 */
export async function submitToSheets(audit, meta) {
  assertUploadConfigured();

  // Flatten all photos into one array.
  // - areaLabel uses the human-readable label from areas.js (e.g. "Floor Surface")
  // - photoIndex is 1-based within the area, for Drive file naming
  // - dataUrl is the annotated composite if the photo has marks, raw otherwise
  // - comment is included so the Apps Script can add it as a Drive file description
  const photoEntries = Object.entries(audit.areaPhotos);
  const photos = [];

  for (const [areaId, photoArr] of photoEntries) {
    const areaLabel = getArea(areaId)?.label ?? areaId;
    for (let i = 0; i < (photoArr || []).length; i++) {
      const photo = photoArr[i];
      const hasAnnotations = photo.annotations && photo.annotations.length > 0;
      const dataUrl = hasAnnotations
        ? await renderAnnotatedImage(photo.dataUrl, photo.annotations)
        : photo.dataUrl;
      photos.push({
        areaLabel,
        photoIndex: i + 1,
        dataUrl,
        comment: photo.comment || '',
      });
    }
  }

  const payload = {
    auditId:          audit.id,
    technicianName:   audit.technicianName,
    clientName:       audit.clientName,
    bathroomType:     audit.bathroomType,
    date:             new Date().toLocaleDateString('en-GB'),
    totalPhotos:      meta.totalPhotos,
    totalAnnotations: meta.totalAnnotations,
    areasSummary:     meta.areasSummary,
    commentsSummary:  meta.commentsSummary,
    photos,
  };

  // mode: 'no-cors' prevents the browser from converting the POST to a GET
  // on the Apps Script redirect. Response is opaque so we can't read it,
  // but the script executes and writes to the Sheet.
  await fetch(SCRIPT_URL, {
    method: 'POST',
    body:   JSON.stringify(payload),
    mode:   'no-cors',
  });
}
