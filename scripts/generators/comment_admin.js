/**
 * comment admin panel
 */

hexo.extend.generator.register('comment_admin', function (locals) {
  const { site_tree, comments } = hexo.theme.config

  if (!comments?.admin?.enable) {
    return {}
  }

  const adminPath = comments.admin.path || 'comment-admin'

  return [{
    path: adminPath + '/index.html',
    layout: ['comment_admin'],
    data: {
      layout: 'comment_admin',
      menu_id: comments.admin.menu_id || site_tree.post?.menu_id || 'post',
      title: comments.admin.title || '评论管理',
      comment_sources: {
        artalk: comments.artalk || null,
        twikoo: comments.twikoo || null,
        waline: comments.waline || null,
        giscus: comments.giscus || null,
      }
    }
  }]
})
