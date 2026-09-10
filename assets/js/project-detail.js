// Project detail page — fetches and displays a single published project from Supabase
const SUPABASE_URL = 'https://zjezlcglujgizxppimqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O6gt3KvYwhp323qY51m_MA_M9t7tuEs';
const _createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
if (!_createClient) throw new Error('Supabase client not found — include the CDN script before project-detail.js');
const supabaseClient = _createClient(SUPABASE_URL, SUPABASE_KEY);

function parseTags(tagsField){
  if (!tagsField) return [];
  if (Array.isArray(tagsField)) return tagsField;
  if (typeof tagsField === 'string'){
    try {
      const parsed = JSON.parse(tagsField);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function getQueryParam(name){
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

async function loadProjectDetail(){
  const projectId = getQueryParam('id');
  const $loading = $('#project-loading');
  const $error = $('#project-error');
  const $content = $('#project-content');
  
  if (!projectId){
    $loading.hide();
    $error.text('No project ID specified. Please click on a project from the homepage.').show();
    return;
  }

  try {
    $loading.show();

    const candidates = [projectId];
    const numericCandidate = Number(projectId);
    if (!Number.isNaN(numericCandidate) && String(numericCandidate) !== String(projectId)){
      candidates.push(numericCandidate);
    }

    let data = null;
    let fetchError = null;

    for (const candidate of candidates) {
      const result = await supabaseClient
        .from('Projects')
        .select('*')
        .eq('status', 'published')
        .eq('id', candidate)
        .maybeSingle();

      if (result.error) {
        fetchError = result.error;
        continue;
      }

      if (result.data) {
        data = result.data;
        break;
      }
    }
    
    if (!data){
      $loading.hide();
      $error.text(fetchError ? `Project not found or has been unpublished. (${fetchError.message})` : 'Project not found or has been unpublished.').show();
      return;
    }

    // Populate the page with project data
    $('#project-title').text(data.title || '');
    $('#project-description').text(data.description || '');
    
    // Handle image
    if (data.image_url){
      $('#project-image').attr('src', data.image_url).show();
    }
    
    // Handle tags
    const tagArray = parseTags(data.tags);
    if (tagArray.length > 0){
      const tagsHtml = tagArray.map(tag => `<span class="project-tag">${escapeHtml(tag)}</span>`).join('');
      $('#project-tags').html(tagsHtml);
      $('#project-tags-container').show();
    }

    // Handle key highlights
    const highlightArray = parseTags(data.key_highlights);
    if (highlightArray.length > 0){
      const highlightsHtml = highlightArray
        .map(highlight => `<li>${escapeHtml(highlight)}</li>`)
        .join('');
      $('#project-highlights').html(highlightsHtml);
      $('#project-highlights-container').show();
    }

    // Handle project snapshot
    const snapshotFields = [
      ['Role', data.role],
      ['Tools', data.tools],
      ['Focus', data.focus]
    ].filter(([, value]) => value !== null && value !== undefined && String(value).trim());
    if (snapshotFields.length > 0){
      const snapshotHtml = snapshotFields
        .map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHtml(String(value).trim())}</li>`)
        .join('');
      $('#project-snapshot').html(snapshotHtml);
      $('#project-snapshot-container').show();
    }

    // Handle gallery images
    const galleryImages = parseTags(data.gallery_images)
      .filter(imageUrl => typeof imageUrl === 'string' && imageUrl.trim());
    if (galleryImages.length > 0){
      const galleryHtml = galleryImages
        .map(imageUrl => `<div class="col-xs-12 col-sm-6 col-md-4"><img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(data.title || 'Project gallery image')}"></div>`)
        .join('');
      $('#project-gallery').html(galleryHtml);
      $('#project-gallery-container').show();
    }
    
    // Handle project link
    if (data.project_link){
      $('#project-link-btn')
        .attr('href', data.project_link)
        .show();
    }
    
    $loading.hide();
    $error.hide();
    $content.show();
    
  } catch (err){
    $loading.hide();
    $error.text(`Error loading project: ${err.message || err}`).show();
  }
}

function escapeHtml(str){
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str){
  return escapeHtml(str).replace(/"/g, '&quot;');
}

$(document).ready(() => {
  loadProjectDetail();
});
