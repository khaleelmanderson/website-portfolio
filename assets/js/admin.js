// Admin page Supabase logic
// Initializes Supabase client and handles auth, uploads, CRUD for Projects table.

const SUPABASE_URL = 'https://zjezlcglujgizxppimqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O6gt3KvYwhp323qY51m_MA_M9t7tuEs';
// Support different UMD global names from the CDN
const _createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
if (!_createClient) throw new Error('Supabase client not found — include the CDN script before admin.js');
const supabaseClient = _createClient(SUPABASE_URL, SUPABASE_KEY);

$(document).ready(() => {
  const $loginSection = $('#login-section');
  const $dashboard = $('#dashboard-section');
  const $loginAlert = $('#login-alert');
  const $formAlert = $('#form-alert');
  let editingId = null;

  // Check session on load
  (async function checkSession(){
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) showDashboard(); else showLogin();
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
    await supabaseClient.auth.signOut();
    showLogin();
  });

  // Image preview
  $('#image').on('change', function(){
    const file = this.files[0];
    if (!file) { $('#image-preview').hide(); return; }
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
    const title = $('#title').val().trim();
    const description = $('#description').val().trim();
    const tags = $('#tags').val().split(',').map(t=>t.trim()).filter(Boolean);
    const project_link = $('#project_link').val().trim() || null;
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'')}`;
        const path = filename;
        const { error: upErr } = await supabaseClient.storage.from('project-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabaseClient.storage.from('project-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
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
    $('#projects-list').html('<p>Loading…</p>');
    const { data, error } = await supabaseClient.from('Projects').select('*').order('created_at', { ascending: false });
    if (error){ $('#projects-list').html(`<div class="alert alert-danger">${error.message}</div>`); return; }
    renderProjects(data || []);
  }

  function renderProjects(items){
    const $list = $('#projects-list').empty();
    if (!items.length) { $list.html('<p>No projects yet.</p>'); return; }
    items.forEach(p => {
      const $row = $(`<div class="row project-row"></div>`);
      const $left = $(`<div class="col-sm-2"></div>`);
      const $mid = $(`<div class="col-sm-8"></div>`);
      const $right = $(`<div class="col-sm-2 text-right"></div>`);

      if (p.image_url) $left.append(`<img src="${p.image_url}" style="max-width:100%;border-radius:4px">`);
      $mid.append(`<strong>${escapeHtml(p.title || '')}</strong> <span class="label label-info status-badge">${p.status||''}</span><div>${escapeHtml((p.description||'').slice(0,200))}</div>`);
      const editBtn = $(`<button class="btn btn-xs btn-primary" data-id="${p.id}">Edit</button>`).on('click', ()=> startEdit(p));
      const delBtn = $(`<button class="btn btn-xs btn-danger" data-id="${p.id}">Delete</button>`).on('click', ()=> removeProject(p));
      $right.append(editBtn).append(' ').append(delBtn);

      $row.append($left).append($mid).append($right);
      $list.append($row);
    });
  }

  function startEdit(p){
    editingId = p.id;
    $('#project-id').val(p.id);
    $('#title').val(p.title);
    $('#description').val(p.description);
    $('#tags').val((p.tags||[]).join(', '));
    $('#project_link').val(p.project_link || '');
    if (p.image_url){ $('#image-preview').attr('src', p.image_url).show(); }
    $('#publish-btn').hide();
    $('#draft-btn').hide();
    $('#update-btn').show();
    $('#cancel-btn').show();
  }

  async function updateProject(){
    $formAlert.hide();
    const title = $('#title').val().trim();
    const description = $('#description').val().trim();
    const tags = $('#tags').val().split(',').map(t=>t.trim()).filter(Boolean);
    const project_link = $('#project_link').val().trim() || null;
    const fileInput = document.getElementById('image');
    let image_url = null;

    try {
      if (fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'')}`;
        const path = filename;
        const { error: upErr } = await supabaseClient.storage.from('project-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabaseClient.storage.from('project-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      // Update without changing status
      const payload = { title, description, tags, project_link };
      if (image_url) payload.image_url = image_url;

      const { error: updErr } = await supabaseClient.from('Projects').update(payload).eq('id', editingId);
      if (updErr) throw updErr;
      
      $formAlert.removeClass('alert-danger').addClass('alert-success').text('Project updated successfully!').show();
      resetForm();
      loadProjects();
    } catch (err){
      $formAlert.removeClass('alert-success').addClass('alert-danger').text(err.message || 'Update failed').show();
    }
  }

  async function removeProject(p){
    if (!confirm('Delete this project? This will remove the database row and attempt to remove the image.')) return;
    try{
      const { error } = await supabaseClient.from('Projects').delete().eq('id', p.id);
      if (error) throw error;
      // attempt to remove image from storage if image_url exists
      if (p.image_url){
        // extract path after /project-images/
        const match = p.image_url.match(/project-images\/(.*)$/);
        if (match && match[1]){
          await supabaseClient.storage.from('project-images').remove([decodeURIComponent(match[1])]);
        }
      }
      loadProjects();
    }catch(err){ alert(err.message || 'Delete failed'); }
  }

  function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

});
