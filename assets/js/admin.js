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
  let editingGalleryImages = [];
  let selectedGalleryFiles = [];
  let rejectedGalleryFiles = [];
  let galleryPreviewUrls = {};

  function getGalleryFileKey(file) {
    if (!file) return null;
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  function renderGalleryPreview() {
    const $preview = $('#gallery-preview');
    const $invalidList = $('#gallery-invalid-list');
    $preview.empty();

    if (!selectedGalleryFiles.length) {
      $preview.hide();
    } else {
      selectedGalleryFiles.forEach((file) => {
        const fileKey = getGalleryFileKey(file);
        const previewUrl = galleryPreviewUrls[fileKey] || URL.createObjectURL(file);
        galleryPreviewUrls[fileKey] = previewUrl;

        const $thumb = $('<div class="gallery-thumb"></div>');
        const $img = $('<img>').attr({ src: previewUrl, alt: file.name });
        const $name = $('<span class="gallery-thumb-name"></span>').text(file.name);
        const $remove = $('<button type="button" class="gallery-thumb-remove" aria-label="Remove image">&times;</button>');
        $remove.on('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          removeGalleryFile(file);
        });

        $thumb.append($img).append($name).append($remove);
        $preview.append($thumb);
      });
      $preview.css('display', 'flex').show();
    }

    $invalidList.empty();
    if (!rejectedGalleryFiles.length) {
      $invalidList.hide();
      return;
    }

    rejectedGalleryFiles.forEach((entry) => {
      const $item = $('<div class="gallery-invalid-item"></div>');
      const $name = $('<span class="gallery-invalid-name"></span>').text(entry.file.name);
      const $message = $('<span class="text-danger"></span>').text(` — ${entry.error}`);
      $item.append($name).append($message);
      $invalidList.append($item);
    });
    $invalidList.show();
  }

  function removeGalleryFile(file) {
    const fileKey = getGalleryFileKey(file);
    if (!fileKey) return;

    const existingIndex = selectedGalleryFiles.findIndex((item) => getGalleryFileKey(item) === fileKey);
    if (existingIndex !== -1) {
      selectedGalleryFiles.splice(existingIndex, 1);
    }

    if (galleryPreviewUrls[fileKey]) {
      URL.revokeObjectURL(galleryPreviewUrls[fileKey]);
      delete galleryPreviewUrls[fileKey];
    }

    renderGalleryPreview();
  }

  function addGalleryFiles(fileList) {
    const incomingFiles = Array.from(fileList || []);
    const validFiles = [];
    const invalidEntries = [];

    incomingFiles.forEach((file) => {
      const validationError = validateImageFile(file);
      if (validationError) {
        invalidEntries.push({ file, error: validationError });
        return;
      }

      const fileKey = getGalleryFileKey(file);
      const alreadySelected = selectedGalleryFiles.some((item) => getGalleryFileKey(item) === fileKey);
      if (!alreadySelected) {
        validFiles.push(file);
      }
    });

    selectedGalleryFiles = selectedGalleryFiles.concat(validFiles);
    rejectedGalleryFiles = rejectedGalleryFiles.concat(invalidEntries);
    renderGalleryPreview();
    $('#gallery-images').val('');
  }

  function resetGalleryUploadState() {
    selectedGalleryFiles = [];
    rejectedGalleryFiles = [];
    Object.keys(galleryPreviewUrls).forEach((key) => {
      URL.revokeObjectURL(galleryPreviewUrls[key]);
    });
    galleryPreviewUrls = {};
    renderGalleryPreview();
    $('#gallery-images').val('');
  }

  function handleGalleryDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    $('#gallery-dropzone').removeClass('is-dragover');
    if (event.originalEvent && event.originalEvent.dataTransfer && event.originalEvent.dataTransfer.files) {
      addGalleryFiles(event.originalEvent.dataTransfer.files);
    }
  }

  $('#gallery-dropzone').on('dragover dragenter', (event) => {
    event.preventDefault();
    event.stopPropagation();
    $('#gallery-dropzone').addClass('is-dragover');
  });

  $('#gallery-dropzone').on('dragleave', (event) => {
    if (!$(event.currentTarget).is(':hover')) {
      $('#gallery-dropzone').removeClass('is-dragover');
    }
  });

  $('#gallery-dropzone').on('drop', handleGalleryDrop);
  $('#gallery-dropzone').on('click', (event) => {
    if ($(event.target).closest('.gallery-thumb, .gallery-thumb-remove, .gallery-browse-btn').length) {
      return;
    }
    const fileInput = document.getElementById('gallery-images');
    if (fileInput) {
      fileInput.click();
    }
  });

  $('#gallery-dropzone').on('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      $('#gallery-images').trigger('click');
    }
  });

  $('.gallery-browse-btn').on('click', (event) => {
    event.preventDefault();
    const fileInput = document.getElementById('gallery-images');
    if (fileInput) {
      fileInput.click();
    }
  });

  $('#gallery-images').on('change', function(){
    addGalleryFiles(this.files);
  });

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
    const role = $('#role').val().trim() || null;
    const tools = $('#tools').val().trim() || null;
    const focus = $('#focus').val().trim() || null;
    const key_highlights = JSON.stringify(parseLineInput($('#key_highlights').val()));
    const project_link = sanitizeProjectLink($('#project_link').val().trim() || null);
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const fileValidationError = validateImageFile(file);
        if (fileValidationError) throw new Error(fileValidationError);
        image_url = await uploadImageFile(file, 'cover');
      }

      const gallery_images = JSON.stringify(await uploadGalleryImages(selectedGalleryFiles));

      const payload = { title, description, tags, role, tools, focus, key_highlights, gallery_images, project_link, image_url, status };

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
    editingGalleryImages = [];
    resetGalleryUploadState();
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
      const statusClass = p.status === 'published' ? 'status-published' : 'status-draft';
      $mid.append(`<strong>${escapeHtml(p.title || '')}</strong> <span class="label label-info status-badge ${statusClass}">${escapeHtml(p.status || '')}</span><div>${escapeHtml((p.description||'').slice(0,200))}</div>`);
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
    editingGalleryImages = parseTags(p.gallery_images);
    resetGalleryUploadState();
    $('#project-id').val(p.id);
    $('#title').val(p.title);
    $('#description').val(p.description);
    $('#tags').val(parseTags(p.tags).join(', '));
    $('#role').val(p.role || '');
    $('#tools').val(p.tools || '');
    $('#focus').val(p.focus || '');
    $('#key_highlights').val(parseTags(p.key_highlights).join('\n'));
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
    const role = $('#role').val().trim() || null;
    const tools = $('#tools').val().trim() || null;
    const focus = $('#focus').val().trim() || null;
    const key_highlights = JSON.stringify(parseLineInput($('#key_highlights').val()));
    const project_link = sanitizeProjectLink($('#project_link').val().trim() || null);
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const fileValidationError = validateImageFile(file);
        if (fileValidationError) throw new Error(fileValidationError);
        image_url = await uploadImageFile(file, 'cover');
      }

      const newGalleryImages = await uploadGalleryImages(selectedGalleryFiles);
      const gallery_images = JSON.stringify(editingGalleryImages.concat(newGalleryImages));

      // Update without changing status
      const payload = { title, description, tags, role, tools, focus, key_highlights, gallery_images, project_link };
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

    if (!confirm('Delete this project? This will remove the database row and all associated images.')) return;
    try{
      const { error } = await supabaseClient.from('Projects').delete().eq('id', p.id);
      if (error) throw error;
      let cleanupWarning = '';
      const imagePaths = [p.image_url, ...parseTags(p.gallery_images)]
        .map(getStorageImagePath)
        .filter(Boolean);
      if (imagePaths.length){
        const { error: removeErr } = await supabaseClient.storage.from('project-images').remove(imagePaths);
        if (removeErr) {
          console.error('Deleted project image cleanup failed:', removeErr);
          cleanupWarning = ' Project deleted, but one or more images could not be deleted from storage.';
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

  function parseLineInput(value){
    return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  async function uploadImageFile(file, prefix){
    const fileValidationError = validateImageFile(file);
    if (fileValidationError) throw new Error(fileValidationError);
    const filename = `${Date.now()}_${prefix}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'')}`;
    const { error: uploadError } = await supabaseClient.storage.from('project-images').upload(filename, file);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabaseClient.storage.from('project-images').getPublicUrl(filename);
    const imageUrl = sanitizeImageUrl(urlData?.publicUrl || null);
    if (!imageUrl) throw new Error('Unable to create a public URL for the uploaded image.');
    return imageUrl;
  }

  async function uploadGalleryImages(files){
    const imageUrls = [];
    for (let index = 0; index < files.length; index++) {
      imageUrls.push(await uploadImageFile(files[index], `gallery_${index}`));
    }
    return imageUrls;
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
