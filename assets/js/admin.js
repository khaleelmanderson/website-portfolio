// Admin page Supabase logic
// Initializes Supabase client and handles auth, uploads, CRUD for Projects table.

const SUPABASE_URL = 'https://zjezlcglujgizxppimqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O6gt3KvYwhp323qY51m_MA_M9t7tuEs';
// Support different UMD global names from the CDN
const _createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
if (!_createClient) throw new Error('Supabase client not found — include the CDN script before admin.js');
const supabaseClient = _createClient(SUPABASE_URL, SUPABASE_KEY);

async function requireAuthenticated() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!session) {
      throw new Error('You must be logged in to perform this action.');
    }
  } catch (err) {
    throw new Error(err.message || 'Unable to verify your session.');
  }
}

$(document).ready(() => {
  const $loginSection = $('#login-section');
  const $dashboard = $('#dashboard-section');
  const $loginAlert = $('#login-alert');
  const $formAlert = $('#form-alert');
  let editingId = null;
  let editingImageUrl = null;

  // Check session on load
  (async function checkSession(){
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session) showDashboard(); else showLogin();
    } catch (err) {
      $loginAlert.text(err.message || 'Unable to verify your session.').show();
      showLogin();
    }
  })();

  // Login
  $('#login-form').on('submit', async (e) => {
    e.preventDefault();
    $loginAlert.hide();
    const email = $('#login-email').val();
    const password = $('#login-password').val();
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showDashboard();
    } catch (err) {
      $loginAlert.text(err.message || 'Login failed').show();
    }
  });

  $('#logout-btn').on('click', async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      showLogin();
    } catch (err) {
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Logout failed').show();
    }
  });

  // Image preview
  $('#image').on('change', function(){
    const file = this.files[0];
    if (!file) { $('#image-preview').hide(); return; }
    const validationError = validateImageFile(file);
    if (validationError) {
      $(this).val('');
      $('#image-preview').hide();
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(validationError).show();
      return;
    }
    const url = URL.createObjectURL(file);
    $('#image-preview').attr('src', url).show();
  });

  // Publish / Draft buttons
  $('#publish-btn').on('click', () => submitForm('published'));
  $('#draft-btn').on('click', () => submitForm('draft'));
  
  // Edit mode buttons
  $('#update-btn').on('click', () => updateProject());
  $('#cancel-btn').on('click', () => { resetForm(); });

  async function submitForm(status){
    $formAlert.hide();
    try {
      await requireAuthenticated();
    } catch (err) {
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'You are not authorized to save projects.').show();
      showLogin();
      return;
    }

    const title = $('#title').val().trim();
    const description = $('#description').val().trim();
    const tags = parseInputTags($('#tags').val());
    const project_link = sanitizeProjectLink($('#project_link').val().trim() || null);
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const fileValidationError = validateImageFile(file);
        if (fileValidationError) throw new Error(fileValidationError);
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'')}`;
        const path = filename;
        const { error: upErr } = await supabaseClient.storage.from('project-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabaseClient.storage.from('project-images').getPublicUrl(path);
        image_url = sanitizeImageUrl(urlData?.publicUrl || null);
      }

      const payload = { title, description, tags, project_link, image_url, status };

      if (editingId){
        // update
        const { error: updErr } = await supabaseClient.from('Projects').update(payload).eq('id', editingId);
        if (updErr) throw updErr;
        resetForm();
      } else {
        // insert
        const { error: insErr } = await supabaseClient.from('Projects').insert({ ...payload, created_at: new Date().toISOString() });
        if (insErr) throw insErr;
        resetForm();
      }

      loadProjects();
    } catch (err){
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Save failed').show();
    }
  }

  function resetForm(){
    editingId = null;
    editingImageUrl = null;
    $('#project-id').val('');
    $('#project-form')[0].reset();
    $('#image-preview').hide();
    $('#publish-btn').show();
    $('#draft-btn').show();
    $('#update-btn').hide();
    $('#cancel-btn').hide();
  }

  function showLogin(){
    $loginSection.show();
    $dashboard.hide();
  }

  function showDashboard(){
    $loginSection.hide();
    $dashboard.show();
    loadProjects();
  }

  async function loadProjects(){
    const $list = $('#projects-list');
    $list.html('<p class="projects-loading">Loading...</p>');
    try {
      const { data, error } = await supabaseClient.from('Projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      renderProjects(data || []);
    } catch (err) {
      $list.html(`<div class="alert alert-danger">${escapeHtml(err.message || 'Unable to load projects.')}</div>`);
    } finally {
      $list.find('.projects-loading').remove();
    }
  }

  function renderProjects(items){
    const $list = $('#projects-list').empty();
    if (!items.length) { $list.html('<p>No projects yet.</p>'); return; }
    items.forEach(p => {
      const $row = $(`<div class="row project-row"></div>`);
      const $left = $(`<div class="col-sm-2"></div>`);
      const $mid = $(`<div class="col-sm-8"></div>`);
      const $right = $(`<div class="col-sm-2 text-right"></div>`);

      const safeImageUrl = sanitizeImageUrl(p.image_url);
      if (safeImageUrl) $left.append(`<img src="${safeImageUrl}" alt="${escapeAttr(p.title || 'Project image')}" style="max-width:100%;border-radius:4px">`);
      $mid.append(`<strong>${escapeHtml(p.title || '')}</strong> <span class="label label-info status-badge">${escapeHtml(p.status || '')}</span><div>${escapeHtml((p.description||'').slice(0,200))}</div>`);
      const editBtn = $(`<button class="btn btn-xs btn-primary" data-id="${p.id}">Edit</button>`).on('click', async () => {
        try {
          await startEdit(p);
        } catch (err) {
          $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Unable to open the editor.').show();
        }
      });
      const delBtn = $(`<button class="btn btn-xs btn-danger" data-id="${p.id}">Delete</button>`).on('click', async () => {
        try {
          await removeProject(p);
        } catch (err) {
          $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Delete failed').show();
        }
      });
      $right.append(editBtn).append(' ').append(delBtn);

      $row.append($left).append($mid).append($right);
      $list.append($row);
    });
  }

  async function startEdit(p){
    try {
      await requireAuthenticated();
    } catch (err) {
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'You are not authorized to edit projects.').show();
      showLogin();
      return;
    }

    editingId = p.id;
    editingImageUrl = sanitizeImageUrl(p.image_url);
    $('#project-id').val(p.id);
    $('#title').val(p.title);
    $('#description').val(p.description);
    $('#tags').val(parseTags(p.tags).join(', '));
    const safeProjectLink = sanitizeProjectLink(p.project_link);
    $('#project_link').val(safeProjectLink || '');
    const safeImageUrl = sanitizeImageUrl(p.image_url);
    if (safeImageUrl){ $('#image-preview').attr('src', safeImageUrl).show(); }
    $('#publish-btn').hide();
    $('#draft-btn').hide();
    $('#update-btn').show();
    $('#cancel-btn').show();
  }

  async function updateProject(){
    $formAlert.hide();
    try {
      await requireAuthenticated();
    } catch (err) {
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'You are not authorized to update projects.').show();
      showLogin();
      return;
    }

    const title = $('#title').val().trim();
    const description = $('#description').val().trim();
    const tags = parseInputTags($('#tags').val());
    const project_link = sanitizeProjectLink($('#project_link').val().trim() || null);
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const fileValidationError = validateImageFile(file);
        if (fileValidationError) throw new Error(fileValidationError);
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'')}`;
        const path = filename;
        const { error: upErr } = await supabaseClient.storage.from('project-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabaseClient.storage.from('project-images').getPublicUrl(path);
        image_url = sanitizeImageUrl(urlData?.publicUrl || null);
      }

      // Update without changing status
      const payload = { title, description, tags, project_link };
      if (image_url) payload.image_url = image_url;

      const { error: updErr } = await supabaseClient.from('Projects').update(payload).eq('id', editingId);
      if (updErr) throw updErr;

      let cleanupWarning = '';
      if (image_url && editingImageUrl && image_url !== editingImageUrl) {
        const oldImagePath = getStorageImagePath(editingImageUrl);
        if (oldImagePath) {
          const { error: removeErr } = await supabaseClient.storage.from('project-images').remove([oldImagePath]);
          if (removeErr) {
            console.error('Project image replacement cleanup failed:', removeErr);
            cleanupWarning = ' Project updated, but the old image could not be deleted from storage.';
          }
        }
      }
      
      $formAlert.removeClass('alert-danger').addClass(cleanupWarning ? 'alert-warning' : 'alert-success').text(`Project updated successfully!${cleanupWarning}`).show();
      resetForm();
      loadProjects();
    } catch (err){
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Update failed').show();
    }
  }

  async function removeProject(p){
    try {
      await requireAuthenticated();
    } catch (err) {
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'You are not authorized to delete projects.').show();
      showLogin();
      return;
    }

    if (!confirm('Delete this project? This will remove the database row and attempt to remove the image.')) return;
    try{
      const { error } = await supabaseClient.from('Projects').delete().eq('id', p.id);
      if (error) throw error;
      let cleanupWarning = '';
      const imagePath = getStorageImagePath(p.image_url);
      if (imagePath){
        const { error: removeErr } = await supabaseClient.storage.from('project-images').remove([imagePath]);
        if (removeErr) {
          console.error('Deleted project image cleanup failed:', removeErr);
          cleanupWarning = ' Project deleted, but its image could not be deleted from storage.';
        }
      }
      if (cleanupWarning) {
        $formAlert.removeClass('alert-danger').addClass('alert-warning').text(cleanupWarning).show();
      }
      loadProjects();
    }catch(err){
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Delete failed').show();
    }
  }

  function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(str){ return String(str||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function parseTags(tagsField){
    if (!tagsField) return [];
    if (Array.isArray(tagsField)) return tagsField;
    if (typeof tagsField === 'string'){
      try {
        const parsed = JSON.parse(tagsField);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    return [];
  }

  function parseInputTags(tagsField){
    return String(tagsField || '').split(',').map(tag => tag.trim()).filter(Boolean);
  }

  function validateImageFile(file) {
    if (!file) return 'Please choose an image file.';
    if (!file.type || !file.type.startsWith('image/')) {
      return 'Only image files are allowed.';
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return 'Image must be 5MB or smaller.';
    }
    return null;
  }

  function sanitizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (err) {
      return null;
    }
  }

  function getStorageImagePath(url) {
    const safeImageUrl = sanitizeImageUrl(url);
    if (!safeImageUrl) return null;
    try {
      const pathname = new URL(safeImageUrl).pathname;
      const marker = '/project-images/';
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex === -1) return null;
      return decodeURIComponent(pathname.slice(markerIndex + marker.length));
    } catch (err) {
      return null;
    }
  }

  function sanitizeProjectLink(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (err) {
      return null;
    }
  }

});
