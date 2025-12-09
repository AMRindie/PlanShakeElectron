// app.undo.js - Unified Undo/Redo System for Board and Notes
// Provides centralized toast notifications and undo/redo stacks

(function () {
    'use strict';

    const MAX_STACK_SIZE = 20;

    // ================================
    // UNDO/REDO STACKS
    // ================================

    const stacks = {
        cardMove: [],      // Card movement undo
        cardAction: []     // Card delete/archive undo
    };

    const redoStacks = {
        cardMove: []
    };

    // ================================
    // TOAST ELEMENT
    // ================================

    let toastElement = null;
    let toastTimeout = null;

    /**
     * Hide all visible toast notifications
     */
    function hideAllToasts() {
        document.querySelectorAll('.undo-toast').forEach(toast => {
            toast.classList.remove('visible');
        });
    }

    /**
     * Show a toast notification with optional action button
     */
    function showToast(message, options = {}) {
        hideAllToasts();

        if (!toastElement) {
            toastElement = document.createElement('div');
            toastElement.className = 'undo-toast';
            document.body.appendChild(toastElement);
        }

        const {
            type = 'info',
            onAction = null,
            actionLabel = null,
            duration = 4000
        } = options;

        let html = `<span>${message}</span>`;
        if (onAction && actionLabel) {
            html += `<button class="toast-action-btn">${actionLabel}</button>`;
        }

        toastElement.innerHTML = html;

        if (onAction) {
            const btn = toastElement.querySelector('.toast-action-btn');
            if (btn) {
                btn.onclick = () => onAction();
            }
        }

        toastElement.classList.add('visible');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('visible');
        }, duration);
    }

    function hideToast() {
        if (toastElement) {
            toastElement.classList.remove('visible');
        }
        clearTimeout(toastTimeout);
    }

    // ================================
    // CARD MOVE UNDO/REDO
    // ================================

    function pushCardMove(moveInfo) {
        stacks.cardMove.push(moveInfo);
        if (stacks.cardMove.length > MAX_STACK_SIZE) {
            stacks.cardMove.shift();
        }
        redoStacks.cardMove = [];
    }

    function undoCardMove(project) {
        if (stacks.cardMove.length === 0) return false;

        const move = stacks.cardMove.pop();
        const fromList = project.lists.find(l => l.id === move.toListId);
        const toList = project.lists.find(l => l.id === move.fromListId);

        if (!fromList || !toList) return false;

        const cardIndex = fromList.cards.findIndex(c => c.id === move.cardId);
        if (cardIndex === -1) return false;

        const [card] = fromList.cards.splice(cardIndex, 1);
        toList.cards.splice(move.fromIndex, 0, card);

        redoStacks.cardMove.push(move);
        return true;
    }

    function redoCardMove(project) {
        if (redoStacks.cardMove.length === 0) return false;

        const move = redoStacks.cardMove.pop();
        const fromList = project.lists.find(l => l.id === move.fromListId);
        const toList = project.lists.find(l => l.id === move.toListId);

        if (!fromList || !toList) return false;

        const cardIndex = fromList.cards.findIndex(c => c.id === move.cardId);
        if (cardIndex === -1) return false;

        const [card] = fromList.cards.splice(cardIndex, 1);
        toList.cards.splice(move.toIndex, 0, card);

        stacks.cardMove.push(move);
        return true;
    }

    function canUndoCardMove() {
        return stacks.cardMove.length > 0;
    }

    function canRedoCardMove() {
        return redoStacks.cardMove.length > 0;
    }

    // ================================
    // CARD ACTION (DELETE/ARCHIVE) UNDO
    // ================================

    function pushCardAction(actionInfo) {
        stacks.cardAction.push(actionInfo);
        if (stacks.cardAction.length > MAX_STACK_SIZE) {
            stacks.cardAction.shift();
        }
    }

    function undoCardAction(project) {
        if (stacks.cardAction.length === 0) return false;

        const action = stacks.cardAction.pop();
        const targetList = project.lists.find(l => l.id === action.listId);

        if (!targetList) return false;

        targetList.cards.splice(action.index, 0, action.card);

        if (action.type === 'archive' && project.archive) {
            project.archive.cards = project.archive.cards.filter(
                c => c.id !== action.card.id
            );
        }

        return true;
    }

    function canUndoCardAction() {
        return stacks.cardAction.length > 0;
    }

    // ================================
    // HELPER: Get translated strings
    // ================================

    function getTranslation(key) {
        return window.t ? window.t(key) : null;
    }

    // ================================
    // TOAST HELPERS
    // ================================

    function showCardMoveUndoToast() {
        showToast(getTranslation('cardMoveUndone') || 'Card move undone', {
            type: 'undo',
            actionLabel: getTranslation('redo') || 'Redo',
            onAction: () => {
                if (window.currentProject && redoCardMove(window.currentProject)) {
                    if (window.renderBoard) window.renderBoard();
                    if (window.saveDataDebounced) window.saveDataDebounced(window.currentData);
                    showCardMoveRedoToast();
                }
            }
        });
    }

    function showCardMoveRedoToast() {
        showToast(getTranslation('actionRestored') || 'Action restored', {
            type: 'redo',
            actionLabel: getTranslation('undo') || 'Undo',
            onAction: () => {
                if (window.currentProject && undoCardMove(window.currentProject)) {
                    if (window.renderBoard) window.renderBoard();
                    if (window.saveDataDebounced) window.saveDataDebounced(window.currentData);
                    showCardMoveUndoToast();
                }
            }
        });
    }

    function showCardActionToast(message) {
        showToast(message, {
            type: 'info',
            actionLabel: getTranslation('undo') || 'Undo',
            duration: 5000,
            onAction: () => {
                if (window.currentProject && undoCardAction(window.currentProject)) {
                    if (window.renderBoard) window.renderBoard();
                    if (window.saveData) window.saveData(window.currentData);
                    showToast(getTranslation('actionRestored') || 'Restored', { duration: 1500 });
                }
            }
        });
    }

    function showNotesUndoToast(isUndo, onSave) {
        const message = isUndo
            ? (getTranslation('actionUndone') || 'Action undone')
            : (getTranslation('actionRestored') || 'Action restored');

        const actionLabel = isUndo
            ? (getTranslation('redo') || 'Redo')
            : (getTranslation('undo') || 'Undo');

        showToast(message, {
            type: isUndo ? 'undo' : 'redo',
            actionLabel: actionLabel,
            onAction: () => {
                if (isUndo) {
                    document.execCommand('redo', false, null);
                    showNotesUndoToast(false, onSave);
                } else {
                    document.execCommand('undo', false, null);
                    showNotesUndoToast(true, onSave);
                }
                if (onSave) onSave();
            }
        });
    }

    // ================================
    // EXPORT TO GLOBAL
    // ================================

    window.UndoManager = {
        showToast,
        hideToast,
        hideAllToasts,
        pushCardMove,
        undoCardMove,
        redoCardMove,
        canUndoCardMove,
        canRedoCardMove,
        showCardMoveUndoToast,
        showCardMoveRedoToast,
        pushCardAction,
        undoCardAction,
        canUndoCardAction,
        showCardActionToast,
        showNotesUndoToast
    };

    window.hideAllToasts = hideAllToasts;

})();
