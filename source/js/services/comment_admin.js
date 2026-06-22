/**
 * Comment Admin Panel - Unified comment management
 * Supports Artalk, Twikoo, Waline, Giscus
 */

utils.jq(() => {
  $(function () {
    const $panel = $('.comment-admin-panel')
    if (!$panel.length) return

    const STORAGE_KEY = 'stellar_comment_admin'
    const pageSize = commentAdminConfig?.pageSize || 20

    let allComments = []
    let filteredComments = []
    let currentPage = 1
    let totalPages = 1

    function getStorage() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : { approved: {}, deleted: {}, read: {} }
      } catch (e) {
        return { approved: {}, deleted: {}, read: {} }
      }
    }

    function saveStorage(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch (e) {}
    }

    function getCommentId(comment) {
      return comment.source + '_' + comment.id
    }

    function isApproved(comment) {
      const storage = getStorage()
      const cid = getCommentId(comment)
      if (storage.deleted[cid]) return false
      if (storage.approved[cid]) return true
      return comment.status === 'approved'
    }

    function isDeleted(comment) {
      const storage = getStorage()
      const cid = getCommentId(comment)
      return !!storage.deleted[cid]
    }

    function isRead(comment) {
      const storage = getStorage()
      const cid = getCommentId(comment)
      return !!storage.read[cid]
    }

    function markAsApproved(commentIds) {
      const storage = getStorage()
      commentIds.forEach(id => {
        storage.approved[id] = true
        storage.read[id] = true
      })
      saveStorage(storage)
    }

    function markAsDeleted(commentIds) {
      const storage = getStorage()
      commentIds.forEach(id => {
        storage.deleted[id] = true
      })
      saveStorage(storage)
    }

    function markAsRead(commentIds) {
      const storage = getStorage()
      commentIds.forEach(id => {
        storage.read[id] = true
      })
      saveStorage(storage)
    }

    function unmarkApproved(commentIds) {
      const storage = getStorage()
      commentIds.forEach(id => {
        delete storage.approved[id]
        delete storage.read[id]
      })
      saveStorage(storage)
    }

    // Fetch comments from Artalk
    async function fetchArtalkComments(config) {
      if (!config?.server) return []
      try {
        const api = config.server.replace(/\/$/, '')
        const site = config.site || ''
        const response = await fetch(`${api}/api/v2/comments?site=${encodeURIComponent(site)}&limit=100`, {
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        if (data.comments) {
          return data.comments.map(c => ({
            id: c.id,
            source: 'artalk',
            sourceName: 'Artalk',
            author: c.nick,
            email: c.email,
            content: c.content,
            date: c.created_at || c.date,
            url: c.url || '',
            page_key: c.page_key || '',
            status: c.is_collapsed ? 'pending' : 'approved',
            avatar: c.avatar_url || '',
            ua: c.ua || '',
            ip: c.ip || ''
          }))
        }
        return []
      } catch (e) {
        console.error('Failed to fetch Artalk comments:', e)
        return []
      }
    }

    // Fetch comments from Twikoo
    async function fetchTwikooComments(config) {
      if (!config?.envId) return []
      try {
        const api = config.envId
        const response = await fetch(api, {
          method: 'POST',
          body: JSON.stringify({
            event: 'COMMENT_GET',
            envId: api,
            pageSize: 100
          }),
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        if (data.data) {
          return data.data.map(c => ({
            id: c._id || c.id,
            source: 'twikoo',
            sourceName: 'Twikoo',
            author: c.nick,
            email: c.email,
            content: c.comment,
            date: c.created || c.date,
            url: c.url || '',
            page_key: c.url || '',
            status: c.isSpam ? 'pending' : 'approved',
            avatar: c.avatar || '',
            ua: c.ua || '',
            ip: c.ip || ''
          }))
        }
        return []
      } catch (e) {
        console.error('Failed to fetch Twikoo comments:', e)
        return []
      }
    }

    // Fetch comments from Waline
    async function fetchWalineComments(config) {
      if (!config?.serverURL) return []
      try {
        const api = config.serverURL.replace(/\/$/, '')
        const response = await fetch(`${api}/api/comment?state=pending&pageSize=100`, {
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        if (data.data) {
          return data.data.map(c => ({
            id: c.objectId || c.id,
            source: 'waline',
            sourceName: 'Waline',
            author: c.nick,
            email: c.mail,
            content: c.comment,
            date: c.createdAt || c.insertedAt || c.date,
            url: c.url || '',
            page_key: c.url || '',
            status: c.status === 1 ? 'approved' : 'pending',
            avatar: c.avatar || '',
            ua: c.ua || '',
            ip: c.ip || ''
          }))
        }
        return []
      } catch (e) {
        console.error('Failed to fetch Waline comments:', e)
        return []
      }
    }

    // Fetch comments from Giscus (using GitHub API)
    async function fetchGiscusComments(config) {
      if (!config?.['data-repo']) return []
      try {
        const repo = config['data-repo']
        const category = config['data-category'] || 'General'
        const apiUrl = `https://api.github.com/repos/${repo}/discussions?category=${encodeURIComponent(category)}&per_page=10`

        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        })
        const discussions = await response.json()

        const comments = []
        for (const discussion of discussions) {
          const commentsUrl = discussion.comments_url
          try {
            const commentsRes = await fetch(`${commentsUrl}?per_page=30`, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            })
            const discComments = await commentsRes.json()
            if (Array.isArray(discComments)) {
              discComments.forEach(c => {
                comments.push({
                  id: c.id,
                  source: 'giscus',
                  sourceName: 'Giscus',
                  author: c.user?.login || 'Anonymous',
                  email: '',
                  content: c.body || '',
                  date: c.created_at,
                  url: c.html_url || discussion.html_url || '',
                  page_key: discussion.title || '',
                  status: 'approved',
                  avatar: c.user?.avatar_url || '',
                  ua: '',
                  ip: ''
                })
              })
            }
          } catch (e) {
            console.warn('Failed to fetch Giscus discussion comments:', e)
          }
        }
        return comments
      } catch (e) {
        console.error('Failed to fetch Giscus comments:', e)
        return []
      }
    }

    async function loadAllComments() {
      $('#loadingState').show()
      $('#commentList').empty()
      $('#emptyState').hide()

      const fetchPromises = []

      if (commentSources.artalk?.server) {
        fetchPromises.push(fetchArtalkComments(commentSources.artalk))
      }
      if (commentSources.twikoo?.envId) {
        fetchPromises.push(fetchTwikooComments(commentSources.twikoo))
      }
      if (commentSources.waline?.serverURL) {
        fetchPromises.push(fetchWalineComments(commentSources.waline))
      }
      if (commentSources.giscus?.['data-repo']) {
        fetchPromises.push(fetchGiscusComments(commentSources.giscus))
      }

      try {
        const results = await Promise.all(fetchPromises)
        allComments = results.flat()
        applyFilters()
        updateStats()
      } catch (e) {
        console.error('Failed to load comments:', e)
        allComments = []
      }

      $('#loadingState').hide()
      renderComments()
    }

    function applyFilters() {
      const sourceFilter = $('#sourceFilter').val()
      const statusFilter = $('#statusFilter').val()
      const sortFilter = $('#sortFilter').val()

      filteredComments = allComments.filter(c => {
        if (isDeleted(c)) return false
        if (sourceFilter !== 'all' && c.source !== sourceFilter) return false
        if (statusFilter === 'pending') {
          if (isApproved(c)) return false
        } else if (statusFilter === 'approved') {
          if (!isApproved(c)) return false
        }
        return true
      })

      filteredComments.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return sortFilter === 'date_asc' ? dateA - dateB : dateB - dateA
      })

      totalPages = Math.max(1, Math.ceil(filteredComments.length / pageSize))
      currentPage = 1
    }

    function updateStats() {
      const pending = allComments.filter(c => !isApproved(c) && !isDeleted(c)).length
      const approved = allComments.filter(c => isApproved(c) && !isDeleted(c)).length
      const sources = [...new Set(allComments.map(c => c.source))].length

      $('#pendingCount').text(pending)
      $('#approvedCount').text(approved)
      $('#sourceCount').text(sources)
    }

    function renderComments() {
      const $list = $('#commentList')
      $list.empty()

      if (filteredComments.length === 0) {
        $('#emptyState').show()
        $('#paginationBar').hide()
        return
      }

      $('#emptyState').hide()

      const start = (currentPage - 1) * pageSize
      const end = start + pageSize
      const pageComments = filteredComments.slice(start, end)

      pageComments.forEach(comment => {
        const cid = getCommentId(comment)
        const approved = isApproved(comment)
        const read = isRead(comment)
        const sourceColors = {
          artalk: '#3498ff',
          twikoo: '#0066ff',
          waline: '#42b983',
          giscus: '#6e5494'
        }

        let content = comment.content
        if (content.length > 200) {
          content = content.substring(0, 200) + '...'
        }

        const date = new Date(comment.date).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })

        const $item = $(`
          <div class="comment-item ${approved ? 'approved' : 'pending'} ${read ? 'read' : 'unread'}" data-cid="${cid}" data-source="${comment.source}">
            <div class="comment-checkbox">
              <input type="checkbox" class="comment-check" data-cid="${cid}" />
            </div>
            <div class="comment-avatar">
              ${comment.avatar ? `<img src="${comment.avatar}" alt="avatar" />` : `<div class="avatar-placeholder">${comment.author?.charAt(0) || '?'}</div>`}
            </div>
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">${comment.author || 'Anonymous'}</span>
                <span class="comment-source" style="background: ${sourceColors[comment.source] || '#999'};">${comment.sourceName}</span>
                <span class="comment-date">${date}</span>
                ${approved ? '<span class="comment-status approved-badge">已通过</span>' : '<span class="comment-status pending-badge">待审核</span>'}
              </div>
              <div class="comment-body">${content}</div>
              <div class="comment-page">
                <span class="page-label">页面:</span>
                <a href="${comment.url || '#'}" target="_blank" rel="noopener">${comment.page_key || comment.url || '未知'}</a>
              </div>
            </div>
            <div class="comment-actions">
              ${!approved ? `<button class="action-btn approve-btn" data-cid="${cid}" title="通过">✓</button>` : `<button class="action-btn undo-btn" data-cid="${cid}" title="撤销审核">↩</button>`}
              <button class="action-btn delete-btn" data-cid="${cid}" title="删除">✕</button>
            </div>
          </div>
        `)

        $list.append($item)
      })

      renderPagination()
      updateBatchButtons()
    }

    function renderPagination() {
      const $bar = $('#paginationBar')
      if (totalPages <= 1) {
        $bar.hide()
        return
      }
      $bar.show()
      $('#pageInfo').text(`${currentPage} / ${totalPages}`)
      $('#prevPage').prop('disabled', currentPage === 1)
      $('#nextPage').prop('disabled', currentPage === totalPages)
    }

    function getSelectedIds() {
      return $('.comment-check:checked').map(function () {
        return $(this).data('cid')
      }).get()
    }

    function updateBatchButtons() {
      const selected = getSelectedIds()
      const hasSelected = selected.length > 0
      $('#batchApproveBtn').prop('disabled', !hasSelected)
      $('#batchDeleteBtn').prop('disabled', !hasSelected)
      $('#selectAll').prop('checked', hasSelected && selected.length === $('.comment-check').length)
    }

    function batchApprove() {
      const selected = getSelectedIds()
      if (selected.length === 0) return

      if (confirm(`确定通过 ${selected.length} 条评论吗？`)) {
        markAsApproved(selected)
        applyFilters()
        renderComments()
        updateStats()
        hud.toast(`已通过 ${selected.length} 条评论`, 2000)
      }
    }

    function batchDelete() {
      const selected = getSelectedIds()
      if (selected.length === 0) return

      if (confirm(`确定删除 ${selected.length} 条评论吗？此操作可撤销。`)) {
        markAsDeleted(selected)
        applyFilters()
        renderComments()
        updateStats()
        hud.toast(`已删除 ${selected.length} 条评论`, 2000)
      }
    }

    function singleApprove(cid) {
      markAsApproved([cid])
      applyFilters()
      renderComments()
      updateStats()
      hud.toast('评论已通过', 1500)
    }

    function singleUndo(cid) {
      unmarkApproved([cid])
      applyFilters()
      renderComments()
      updateStats()
      hud.toast('已撤销审核', 1500)
    }

    function singleDelete(cid) {
      if (confirm('确定删除这条评论吗？此操作可撤销。')) {
        markAsDeleted([cid])
        applyFilters()
        renderComments()
        updateStats()
        hud.toast('评论已删除', 1500)
      }
    }

    // Event listeners
    $('#sourceFilter, #statusFilter, #sortFilter').on('change', function () {
      applyFilters()
      renderComments()
    })

    $('#selectAll').on('change', function () {
      $('.comment-check').prop('checked', $(this).prop('checked'))
      updateBatchButtons()
    })

    $(document).on('change', '.comment-check', function () {
      updateBatchButtons()
    })

    $('#batchApproveBtn').on('click', batchApprove)
    $('#batchDeleteBtn').on('click', batchDelete)
    $('#refreshBtn').on('click', loadAllComments)

    $('#prevPage').on('click', function () {
      if (currentPage > 1) {
        currentPage--
        renderComments()
      }
    })

    $('#nextPage').on('click', function () {
      if (currentPage < totalPages) {
        currentPage++
        renderComments()
      }
    })

    $(document).on('click', '.approve-btn', function (e) {
      e.stopPropagation()
      const cid = $(this).data('cid')
      singleApprove(cid)
    })

    $(document).on('click', '.undo-btn', function (e) {
      e.stopPropagation()
      const cid = $(this).data('cid')
      singleUndo(cid)
    })

    $(document).on('click', '.delete-btn', function (e) {
      e.stopPropagation()
      const cid = $(this).data('cid')
      singleDelete(cid)
    })

    $(document).on('click', '.comment-item', function () {
      const cid = $(this).data('cid')
      markAsRead([cid])
      $(this).removeClass('unread').addClass('read')
    })

    // Initialize
    loadAllComments()
  })
})
