// Public projects loader — fetches published projects from Supabase and renders into the homepage
const SUPABASE_URL = 'https://zjezlcglujgizxppimqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O6gt3KvYwhp323qY51m_MA_M9t7tuEs';
const _createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
if (!_createClient) throw new Error('Supabase client not found — include the CDN script before public-projects.js');
const supabaseClient = _createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadPublishedProjects(){
  const $container = $('#projects-container');
  const $loading = $('#projects-loading');
  $container.empty(); $loading.show();
  try{
    const { data, error } = await supabaseClient.from('Projects').select('*').eq('status','published').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0){
      $container.html('<p>No published projects yet.</p>');
    } else {
      data.forEach(p => {
        const img = p.image_url || 'assets/images/PortfolioPic.jpg';
        const tagArray = parseTags(p.tags);
        const details = tagArray.length ? tagArray.join(' | ') : '';
        const col = `
          <div class="col-xs-12 col-sm-6 col-md-4 col-lg-4">
            <a class="thumbnail" href="project-detail.html?id=${p.id}">
              <span class="img">
                <img src="${escapeAttr(img)}" alt="">
                <span class="cover"><span class="more">See details →</span></span>
              </span>
              <span class="title">${escapeHtml(p.title || '')}</span>
            </a>
            <span class="details">${escapeHtml(details)}</span>
            <h4></h4>
            <p></p>
          </div>
        `;
        $container.append(col);
      });
    }
  }catch(err){
    $container.html(`<div class="alert alert-danger">Failed to load projects: ${err.message || err}</div>`);
  }finally{
    $loading.hide();
  }
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function parseTags(tagsField){
  if (!tagsField) return [];
  // If it's already an array, return it
  if (Array.isArray(tagsField)) return tagsField;
  // If it's a string, try to parse it as JSON
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

$(document).ready(()=>{ loadPublishedProjects(); });
