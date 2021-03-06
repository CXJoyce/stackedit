import utils from '../services/utils';

const idShifter = offset => (state, getters) => {
  const ids = Object.keys(getters.currentFileDiscussions);
  const idx = ids.indexOf(state.currentDiscussionId) + offset + ids.length;
  return ids[idx % ids.length];
};

export default {
  namespaced: true,
  state: {
    currentDiscussionId: null,
    newDiscussion: null,
    newDiscussionId: null,
    newCommentText: '',
    newCommentSelection: { start: 0, end: 0 },
    isCommenting: false,
    stickyComment: null,
  },
  mutations: {
    setCurrentDiscussionId: (state, value) => {
      if (state.currentDiscussionId !== value) {
        state.currentDiscussionId = value;
        state.isCommenting = false;
      }
    },
    setNewDiscussion: (state, value) => {
      state.newDiscussion = value;
      state.newDiscussionId = utils.uid();
      state.currentDiscussionId = state.newDiscussionId;
      state.isCommenting = true;
    },
    patchNewDiscussion: (state, value) => {
      Object.assign(state.newDiscussion, value);
    },
    setNewCommentText: (state, value) => {
      state.newCommentText = value || '';
    },
    setNewCommentSelection: (state, value) => {
      state.newCommentSelection = value;
    },
    setIsCommenting: (state, value) => {
      state.isCommenting = value;
      if (!value) {
        state.newDiscussionId = null;
      }
    },
    setStickyComment: (state, value) => {
      state.stickyComment = value;
    },
  },
  getters: {
    newDiscussion: state =>
      state.currentDiscussionId === state.newDiscussionId && state.newDiscussion,
    currentFileDiscussionLastComments: (state, getters, rootState, rootGetters) => {
      const discussions = rootGetters['content/current'].discussions;
      const comments = rootGetters['content/current'].comments;
      const discussionLastComments = {};
      Object.keys(comments).forEach((commentId) => {
        const comment = comments[commentId];
        if (discussions[comment.discussionId]) {
          const lastComment = discussionLastComments[comment.discussionId];
          if (!lastComment || lastComment.created < comment.created) {
            discussionLastComments[comment.discussionId] = comment;
          }
        }
      });
      return discussionLastComments;
    },
    currentFileDiscussions: (state, getters, rootState, rootGetters) => {
      const currentFileDiscussions = {};
      const newDiscussion = getters.newDiscussion;
      if (newDiscussion) {
        currentFileDiscussions[state.newDiscussionId] = newDiscussion;
      }
      const discussions = rootGetters['content/current'].discussions;
      const discussionLastComments = getters.currentFileDiscussionLastComments;
      Object.keys(discussionLastComments)
        .sort((id1, id2) =>
          discussionLastComments[id2].created - discussionLastComments[id1].created)
        .forEach((discussionId) => {
          currentFileDiscussions[discussionId] = discussions[discussionId];
        });
      return currentFileDiscussions;
    },
    currentDiscussion: (state, getters) =>
      getters.currentFileDiscussions[state.currentDiscussionId],
    previousDiscussionId: idShifter(-1),
    nextDiscussionId: idShifter(1),
    currentDiscussionComments: (state, getters, rootState, rootGetters) => {
      const comments = {};
      if (getters.currentDiscussion) {
        const contentComments = rootGetters['content/current'].comments;
        Object.keys(contentComments)
          .filter(commentId =>
            contentComments[commentId].discussionId === state.currentDiscussionId)
          .sort((id1, id2) =>
            contentComments[id1].created - contentComments[id2].created)
          .forEach((commentId) => {
            comments[commentId] = contentComments[commentId];
          });
      }
      return comments;
    },
    currentDiscussionLastCommentId: (state, getters) =>
      Object.keys(getters.currentDiscussionComments).pop(),
    currentDiscussionLastComment: (state, getters) =>
      getters.currentDiscussionComments[getters.currentDiscussionLastCommentId],
  },
  actions: {
    createNewDiscussion({ commit, rootGetters }, selection) {
      if (selection) {
        let text = rootGetters['content/current'].text.slice(selection.start, selection.end).trim();
        const maxLength = 80;
        if (text.length > maxLength) {
          text = `${text.slice(0, maxLength - 1).trim()}…`;
        }
        commit('setNewDiscussion', { ...selection, text });
      }
    },
    cleanCurrentFile(
      { getters, rootGetters, commit, dispatch },
      { filterComment, filterDiscussion } = {},
    ) {
      const discussions = rootGetters['content/current'].discussions;
      const comments = rootGetters['content/current'].comments;
      const patch = {
        discussions: {},
        comments: {},
      };
      Object.keys(comments).forEach((commentId) => {
        const comment = comments[commentId];
        const discussion = discussions[comment.discussionId];
        if (discussion && comment !== filterComment && discussion !== filterDiscussion) {
          patch.discussions[comment.discussionId] = discussion;
          patch.comments[commentId] = comment;
        }
      });

      const nextDiscussionId = getters.nextDiscussionId;
      dispatch('content/patchCurrent', patch, { root: true });
      if (!getters.currentDiscussion) {
        // Keep the gutter open
        commit('setCurrentDiscussionId', nextDiscussionId);
      }
    },
  },
};
