// Global variables
let macros = [];
let selectedMacroIndex = null; // null for no selection, -1 for "All Tasks", 0+ for specific macro
let currentTaskFilter = 'all';
let currentViewMode = 'list';
let boardSortables = [];
let taskListSortable = null; // To store the Sortable instance for the task list

// Initialize modals
const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
const taskFormModal = new bootstrap.Modal(document.getElementById('taskFormModal'));
const analyticsModal = new bootstrap.Modal(document.getElementById('analyticsModal'));

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  loadData(); 
  renderMacros(); // Ensure macros are rendered after loading, before selection highlights

  setupEventListeners();
  setupDragAndDrop(); 
  // updateStats(); // updateStats is called by renderTasks, which is called by selection functions

  const lastSelectedView = localStorage.getItem('selectedView'); 
  if (lastSelectedView === '-1') {
    selectGlobalView('allTasks');
  } else if (lastSelectedView !== null && parseInt(lastSelectedView) >= 0 && macros[parseInt(lastSelectedView)]) {
    selectMacro(parseInt(lastSelectedView));
  } else if (macros.length > 0) {
    selectMacro(0); 
  } else {
    selectGlobalView('allTasks'); 
  }
});

// Setup event listeners
function setupEventListeners() {
  // Task form save button
  document.getElementById('saveTaskBtn').addEventListener('click', saveTaskForm);
  
  // Confirm modal button
  document.getElementById('confirmModalBtn').addEventListener('click', function() {
    if (typeof confirmCallback === 'function') confirmCallback();
    confirmModal.hide();
  });
  
  // Add new task quick button
  document.getElementById('showTaskFormBtn').addEventListener('click', function() {
    resetTaskForm();
    document.getElementById('taskFormModalLabel').textContent = 'Nova Tarefa';
    taskFormModal.show();
  });
  
  // New task input field enter key
  document.getElementById('newTaskInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const taskName = this.value.trim();
      if (taskName && selectedMacroIndex !== null && selectedMacroIndex !== -1) { 
        addQuickTask(taskName);
      }
    }
  });
  
  // New macro input field enter key
  document.getElementById('newMacroInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addMacro();
    }
  });
  
  // Search input
  document.getElementById('searchInput').addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    filterTasks(searchTerm); 
  });
  
  // View mode toggles
  document.querySelectorAll('.view-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const viewMode = this.getAttribute('data-view');
      changeViewMode(viewMode);
    });
  });
  
  // Filter options
  document.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.preventDefault();
      const filterType = this.getAttribute('data-filter');
      applyFilter(filterType);
    });
  });
  
  document.getElementById('analyticsModal').addEventListener('shown.bs.modal', function() {
    renderAnalyticsCharts();
  });
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  const taskListEl = document.getElementById('taskList');
  if (taskListSortable) { 
    taskListSortable.destroy();
  }
  if (selectedMacroIndex !== -1 && selectedMacroIndex !== null) { 
    taskListSortable = new Sortable(taskListEl, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function(evt) {
        const taskId = evt.item.getAttribute('data-id');
        const newIndex = evt.newIndex;
        
        if (selectedMacroIndex !== null && selectedMacroIndex !== -1) { 
          const tasks = macros[selectedMacroIndex].tasks;
          const taskToMove = tasks.find(t => t.id === taskId);
          const originalArrayIndex = tasks.indexOf(taskToMove);

          if (originalArrayIndex !== -1) {
            const [movedTask] = tasks.splice(originalArrayIndex, 1);
            tasks.splice(newIndex, 0, movedTask);
            saveData();
            renderTasks(); 
          }
        }
      }
    });
  } else {
    taskListSortable = null; 
  }
  
  setupBoardSortables();
}


// Setup sortables for board columns
function setupBoardSortables() {
  boardSortables.forEach(sortable => sortable.destroy());
  boardSortables = [];
  
  const columns = ['pendingTasks', 'inProgressTasks', 'completedTasks'];
  columns.forEach(columnId => {
    const column = document.getElementById(columnId);
    if (!column) return; 

    const sortable = new Sortable(column, {
      group: 'tasks',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function(evt) {
        const taskId = evt.item.getAttribute('data-id');
        const newColumnId = evt.to.id;
        
        let taskToUpdate, originalMacroIdx;

        if (selectedMacroIndex === -1) { 
          originalMacroIdx = parseInt(evt.item.dataset.originalMacroIndex);
          const originalTaskIdx = parseInt(evt.item.dataset.originalTaskIndex);
          if (!isNaN(originalMacroIdx) && !isNaN(originalTaskIdx) && macros[originalMacroIdx] && macros[originalMacroIdx].tasks[originalTaskIdx]) {
            taskToUpdate = macros[originalMacroIdx].tasks[originalTaskIdx];
          }
        } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) { 
            originalMacroIdx = selectedMacroIndex;
            taskToUpdate = macros[originalMacroIdx].tasks.find(t => t.id === taskId);
        }

        if (taskToUpdate) {
          let newStatus = 'pending';
          if (newColumnId === 'inProgressTasks') newStatus = 'in-progress';
          else if (newColumnId === 'completedTasks') newStatus = 'completed';
          
          taskToUpdate.status = newStatus;
          if (newStatus === 'completed' && !taskToUpdate.completedAt) {
            taskToUpdate.completedAt = new Date().toISOString();
          } else if (newStatus !== 'completed') {
            delete taskToUpdate.completedAt;
          }
          
          saveData();
          renderMacros(); 
          renderTasks(); 
        }
      }
    });
    boardSortables.push(sortable);
  });
}

// Data Management Functions
function loadData() {
  const savedData = localStorage.getItem('marketingTasks');
  if (savedData) {
    try {
      macros = JSON.parse(savedData);
      macros.forEach(macro => {
        if (!macro.tasks) macro.tasks = [];
        macro.tasks.forEach(task => {
          if (!task.id) task.id = generateId();
          if (!task.status) task.status = 'pending';
          delete task.priority; 
          if (!task.createdAt) task.createdAt = new Date().toISOString();
          if (task.assignee === undefined) task.assignee = ''; 
        });
      });
    } catch (error) {
      console.error('Error loading data:', error);
      macros = [];
    }
  }
}

function saveData() {
  localStorage.setItem('marketingTasks', JSON.stringify(macros));
}

// Generate a unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Macro Management Functions
function addMacro() {
  const input = document.getElementById('newMacroInput');
  const macroName = input.value.trim();
  
  if (macroName) {
    const newMacro = {
      id: generateId(),
      name: macroName,
      tasks: [],
      createdAt: new Date().toISOString()
    };
    macros.push(newMacro);
    macros.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const newIndex = macros.findIndex(macro => macro.id === newMacro.id);
    saveData(); 
    selectMacro(newIndex); 
    input.value = '';
  }
}

function selectGlobalView(viewType) {
    if (viewType === 'allTasks') {
        selectedMacroIndex = -1; 
        renderMacros(); 

        document.getElementById('selectedMacroTitle').textContent = 'Todas as Tarefas';
        document.getElementById('newTaskInput').disabled = true;
        document.getElementById('showTaskFormBtn').disabled = true;
        
        localStorage.setItem('selectedView', selectedMacroIndex.toString());
        renderTasks();
        setupDragAndDrop(); 
    }
}

function selectMacro(index) {
  if (macros[index]) {
    selectedMacroIndex = index; 
    renderMacros(); 

    document.getElementById('selectedMacroTitle').textContent = macros[index].name;
    document.getElementById('newTaskInput').disabled = false;
    document.getElementById('showTaskFormBtn').disabled = false;
    localStorage.setItem('selectedView', selectedMacroIndex.toString()); 
    renderTasks();
    setupDragAndDrop(); 
  } else if (index === -1) { 
    selectGlobalView('allTasks');
  } else {
    if (macros.length > 0) {
        selectMacro(0);
    } else {
        selectGlobalView('allTasks');
    }
  }
}


// Function to get all tasks, augmented with macro info
function getAggregatedTasks() {
    let aggregatedTasks = [];
    macros.forEach((macro, macroIdx) => {
        macro.tasks.forEach((task, taskIdx) => {
            const copiedTask = { ...task }; 
            copiedTask.macroName = macro.name;
            copiedTask.originalMacroIndex = macroIdx;
            copiedTask.originalTaskIndex = taskIdx; 
            aggregatedTasks.push(copiedTask);
        });
    });
    return aggregatedTasks;
}


function editMacro(originalIndex) {
  if (macros[originalIndex]) {
    const editedMacroId = macros[originalIndex].id;
    const wasAllTasksSelected = (selectedMacroIndex === -1);
    const previouslySelectedMacroId = (!wasAllTasksSelected && selectedMacroIndex !== null && macros[selectedMacroIndex]) 
                                     ? macros[selectedMacroIndex].id 
                                     : null;

    showEditModal(macros[originalIndex].name, function(newName) {
      if (newName) {
        const macroToUpdate = macros.find(m => m.id === editedMacroId);
        if (macroToUpdate) macroToUpdate.name = newName;
        
        macros.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        saveData(); 
        
        if (wasAllTasksSelected) {
            selectedMacroIndex = -1; 
        } else if (previouslySelectedMacroId) { 
            const newIdx = macros.findIndex(macro => macro.id === previouslySelectedMacroId);
            selectedMacroIndex = (newIdx !== -1) ? newIdx : (macros.length > 0 ? 0 : -1) ; 
        } else { 
            selectedMacroIndex = macros.findIndex(macro => macro.id === editedMacroId);
            if(selectedMacroIndex === -1 && macros.length > 0) selectedMacroIndex = 0; 
            else if(selectedMacroIndex === -1) selectedMacroIndex = -1; 
        }
        
        if (selectedMacroIndex === -1) {
            selectGlobalView('allTasks'); 
        } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) {
            selectMacro(selectedMacroIndex); 
        } else { 
            selectGlobalView('allTasks');
        }
      }
    });
  }
}

function deleteMacro(index) {
  if (macros[index]) {
    const wasAllTasksSelected = (selectedMacroIndex === -1);
    const idOfSelectedMacroBeforeDelete = (!wasAllTasksSelected && selectedMacroIndex !== null && macros[selectedMacroIndex]) 
                                          ? macros[selectedMacroIndex].id 
                                          : null;
    const wasDeletedMacroSelected = (selectedMacroIndex === index);

    showConfirmModal(`Tem certeza que deseja excluir a macro "${macros[index].name}" e todas as suas tarefas?`, function() {
      macros.splice(index, 1);
      saveData();

      if (wasAllTasksSelected) {
        selectedMacroIndex = -1; 
      } else if (wasDeletedMacroSelected) {
        selectedMacroIndex = macros.length > 0 ? 0 : -1; 
      } else if (idOfSelectedMacroBeforeDelete) {
        const newIdx = macros.findIndex(m => m.id === idOfSelectedMacroBeforeDelete);
        selectedMacroIndex = (newIdx !== -1) ? newIdx : (macros.length > 0 ? 0 : -1);
      } else {
         selectedMacroIndex = macros.length > 0 ? 0 : -1;
      }
      
      if (selectedMacroIndex === -1) {
         selectGlobalView('allTasks');
      } else if (macros[selectedMacroIndex]) { 
         selectMacro(selectedMacroIndex);
      } else { 
         selectGlobalView('allTasks'); 
      }
    });
  }
}


// Task Management Functions
function addQuickTask(taskName) {
  if (selectedMacroIndex !== null && selectedMacroIndex !== -1 && macros[selectedMacroIndex]) {
    const newTask = {
      id: generateId(),
      name: taskName,
      details: '',
      createdAt: new Date().toISOString(),
      status: 'pending', 
      assignee: '' 
    };
    
    macros[selectedMacroIndex].tasks.push(newTask);
    saveData();
    renderMacros(); 
    renderTasks();
    document.getElementById('newTaskInput').value = '';
  }
}

function toggleTaskStatus(taskIndex, macroIndexOverride = null) {
  const targetMacroIndex = macroIndexOverride !== null ? macroIndexOverride : selectedMacroIndex;
  
  if (targetMacroIndex === -1) return; 

  if (targetMacroIndex !== null && macros[targetMacroIndex] && macros[targetMacroIndex].tasks[taskIndex]) {
    const task = macros[targetMacroIndex].tasks[taskIndex];
    
    if (task.status === 'pending') {
      task.status = 'in-progress';
    } else if (task.status === 'in-progress') {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    } else {
      task.status = 'pending';
      delete task.completedAt;
    }
    
    saveData();
    renderMacros(); 
    renderTasks();
  }
}

function editTask(taskIndex, macroIndexOverride = null) {
  const targetMacroIndex = macroIndexOverride !== null ? macroIndexOverride : selectedMacroIndex;

  if (targetMacroIndex === -1) return; 

  if (targetMacroIndex !== null && macros[targetMacroIndex] && macros[targetMacroIndex].tasks[taskIndex]) {
    const task = macros[targetMacroIndex].tasks[taskIndex];
    
    document.getElementById('taskTitle').value = task.name || '';
    document.getElementById('taskDescription').value = task.details || '';
    
    document.getElementById('taskFormModalLabel').textContent = 'Editar Tarefa';
    const form = document.getElementById('taskForm');
    form.setAttribute('data-task-index', taskIndex);
    form.setAttribute('data-original-macro-index', targetMacroIndex); 
    
    taskFormModal.show();
  }
}

function deleteTask(taskIndex, macroIndexOverride = null) {
  const targetMacroIndex = macroIndexOverride !== null ? macroIndexOverride : selectedMacroIndex;

  if (targetMacroIndex === -1) return; 

  if (targetMacroIndex !== null && macros[targetMacroIndex] && macros[targetMacroIndex].tasks[taskIndex]) {
    showConfirmModal(`Tem certeza que deseja excluir a tarefa "${macros[targetMacroIndex].tasks[taskIndex].name}"?`, function() {
      macros[targetMacroIndex].tasks.splice(taskIndex, 1);
      saveData();
      renderMacros(); 
      renderTasks();
    });
  }
}

// Removed showTaskDetails function

// Task Form Management
function resetTaskForm() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskForm').removeAttribute('data-task-index');
  document.getElementById('taskForm').removeAttribute('data-original-macro-index');
}

function saveTaskForm() {
  const taskTitle = document.getElementById('taskTitle').value.trim();
  const taskDescription = document.getElementById('taskDescription').value.trim();
  
  if (!taskTitle) return; 

  const form = document.getElementById('taskForm');
  const taskIndexAttr = form.getAttribute('data-task-index');
  const macroIndexAttr = form.getAttribute('data-original-macro-index'); 

  const isEditing = taskIndexAttr !== null;
  
  let actualMacroIndex;
  if (isEditing && macroIndexAttr !== null) {
      actualMacroIndex = parseInt(macroIndexAttr);
  } else if (selectedMacroIndex !== -1 && selectedMacroIndex !== null) {
      actualMacroIndex = selectedMacroIndex;
  } else {
      console.error("Cannot save task: No specific macro selected for new task.");
      return;
  }

  if (actualMacroIndex === null || actualMacroIndex < 0 || !macros[actualMacroIndex]) {
    console.error("Cannot save task: Invalid or no macro selected.");
    return;
  }

  if (isEditing) {
    const taskToUpdate = macros[actualMacroIndex].tasks[parseInt(taskIndexAttr)];
    if (taskToUpdate) {
        taskToUpdate.name = taskTitle;
        taskToUpdate.details = taskDescription;
    }
  } else {
    const newTask = {
      id: generateId(),
      name: taskTitle,
      details: taskDescription,
      status: 'pending',  
      assignee: '',       
      createdAt: new Date().toISOString()
    };
    macros[actualMacroIndex].tasks.push(newTask);
  }
  
  saveData();
  renderMacros(); 
  renderTasks();
  taskFormModal.hide();
}

// UI Rendering Functions
function renderMacros() {
  const macroList = document.getElementById('macroList');
  const allTasksItemHTML = `<li class="macro-item all-tasks-item" onclick="selectGlobalView('allTasks')"><div class="macro-info"><div class="macro-name"><i class="fas fa-globe"></i> Todas as Tarefas</div></div></li>`;
  
  macroList.innerHTML = ''; 
  macroList.insertAdjacentHTML('beforeend', allTasksItemHTML); 

  macros.forEach((macro, index) => {
    const totalTasks = macro.tasks.length;
    const completedTasks = macro.tasks.filter(task => task.status === 'completed').length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const initials = macro.name.split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    const isCompleted = totalTasks > 0 && completedTasks === totalTasks;
    
    const macroItem = document.createElement('li');
    macroItem.id = `macro-${macro.id}`; 
    macroItem.className = `macro-item dynamic-macro-item ${isCompleted ? 'completed-macro' : ''}`;
    macroItem.setAttribute('data-initials', initials); 
    macroItem.onclick = () => selectMacro(index);
    
    macroItem.innerHTML = `
      <div class="macro-info">
        <div class="macro-name">${macro.name}</div>
        <div class="macro-progress">
          <div class="progress-bar" style="width: ${progressPercentage}%"></div>
        </div>
      </div>
      <div class="macro-actions">
        <button type="button" onclick="editMacro(${index}); event.stopPropagation();">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="delete" onclick="deleteMacro(${index}); event.stopPropagation();">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    macroList.appendChild(macroItem); 
  });

  document.querySelectorAll('#macroList .macro-item').forEach(item => {
    item.classList.remove('active');
  });

  if (selectedMacroIndex === -1) {
    const staticAllTasksItem = macroList.querySelector('.all-tasks-item');
    if (staticAllTasksItem) staticAllTasksItem.classList.add('active');
  } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) {
    const activeMacroElement = document.getElementById(`macro-${macros[selectedMacroIndex].id}`);
    if (activeMacroElement) activeMacroElement.classList.add('active');
  }
  
  updateStats(); 
}

function renderTasks() {
  let tasksToRender = [];
  if (selectedMacroIndex === -1) { 
      tasksToRender = getAggregatedTasks();
  } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) { 
      tasksToRender = [...macros[selectedMacroIndex].tasks]; 
  } else { 
      document.getElementById('taskList').innerHTML = '';
      document.getElementById('pendingTasks').innerHTML = '';
      document.getElementById('inProgressTasks').innerHTML = '';
      document.getElementById('completedTasks').innerHTML = '';
      updateStats(); 
      return;
  }

  tasksToRender = filterTasksByCurrentFilter(tasksToRender);
  
  if (currentViewMode === 'list') {
    renderListView(tasksToRender);
  } else {
    renderBoardView(tasksToRender);
  }
  
  updateStats(); 
}

function renderListView(tasks) { 
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  
  if (tasks.length === 0) return;
  
  tasks.forEach(task => { 
    const displayMacroIndex = task.originalMacroIndex !== undefined ? task.originalMacroIndex : selectedMacroIndex;
    const displayTaskIndex = task.originalTaskIndex !== undefined ? task.originalTaskIndex : macros[displayMacroIndex]?.tasks.findIndex(t => t.id === task.id);

    if (displayTaskIndex === -1 && task.originalTaskIndex === undefined && !(selectedMacroIndex === -1 && task.id) ) return; 


    const listItem = document.createElement('li');
    listItem.className = `list-group-item ${task.status === 'completed' ? 'task-done' : ''}`;
    listItem.setAttribute('data-id', task.id);
    if (task.originalMacroIndex !== undefined) {
        listItem.setAttribute('data-original-macro-index', task.originalMacroIndex);
        listItem.setAttribute('data-original-task-index', task.originalTaskIndex);
    }
    
    listItem.addEventListener('click', function(e) {
      if (!e.target.closest('.task-actions') && !e.target.closest('.form-check-input')) {
        toggleTaskStatus(displayTaskIndex, displayMacroIndex);
      }
    });
    
    let dueDateDisplay = '';
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = task.status !== 'completed' && dueDate < today;
      dueDateDisplay = `
        <div class="meta-item ${isOverdue ? 'text-danger' : ''}">
          <i class="fas fa-calendar${isOverdue ? '-times' : ''}"></i> 
          ${formatDate(task.dueDate)}
        </div>
      `;
    }
    
    listItem.innerHTML = `
      <div class="task-header">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" 
            ${task.status === 'completed' ? 'checked' : ''} 
            onchange="toggleTaskStatus(${displayTaskIndex}, ${displayMacroIndex})">
        </div>
        <div class="task-content">
          <div class="task-title">${task.name}</div>
          ${selectedMacroIndex === -1 && task.macroName ? `<div class="task-macro"><i class="fas fa-layer-group"></i> ${task.macroName}</div>` : ''}
          ${task.details ? `<div class="task-details">${truncateText(task.details, 60)}</div>` : ''}
          <div class="task-meta">
            ${dueDateDisplay}
            ${task.assignee ? `
              <div class="meta-item">
                <i class="fas fa-user"></i> ${task.assignee}
              </div>
            ` : ''}
            <div class="meta-item">
              <i class="fas fa-flag"></i> ${getStatusLabel(task.status)}
            </div>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <!-- Eye icon button removed -->
        <button type="button" onclick="editTask(${displayTaskIndex}, ${displayMacroIndex})">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="delete" onclick="deleteTask(${displayTaskIndex}, ${displayMacroIndex})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    taskList.appendChild(listItem);
  });
}

function renderBoardView(tasksToRender) { 
  document.getElementById('pendingTasks').innerHTML = '';
  document.getElementById('inProgressTasks').innerHTML = '';
  document.getElementById('completedTasks').innerHTML = '';
  
  const pendingTasks = tasksToRender.filter(task => task.status === 'pending');
  const inProgressTasks = tasksToRender.filter(task => task.status === 'in-progress');
  const completedTasks = tasksToRender.filter(task => task.status === 'completed');
  
  renderBoardColumn('pendingTasks', pendingTasks);
  renderBoardColumn('inProgressTasks', inProgressTasks);
  renderBoardColumn('completedTasks', completedTasks);
}

function renderBoardColumn(columnId, tasks) {
  const column = document.getElementById(columnId);
  column.innerHTML = ''; 
  
  if (tasks.length === 0) return;
  
  tasks.forEach(task => {
    const displayMacroIndex = task.originalMacroIndex !== undefined ? task.originalMacroIndex : selectedMacroIndex;
    const displayTaskIndex = task.originalTaskIndex !== undefined ? task.originalTaskIndex : macros[displayMacroIndex]?.tasks.findIndex(t => t.id === task.id);

    if (displayTaskIndex === -1 && task.originalTaskIndex === undefined && !(selectedMacroIndex === -1 && task.id)) return;


    const taskEl = document.createElement('div');
    taskEl.className = 'board-task';
    taskEl.setAttribute('data-id', task.id);
    if (task.originalMacroIndex !== undefined) {
        taskEl.setAttribute('data-original-macro-index', task.originalMacroIndex);
        taskEl.setAttribute('data-original-task-index', task.originalTaskIndex);
    }
    
    taskEl.addEventListener('click', function(e) {
      if (!e.target.closest('.task-action-btn')) { 
        toggleTaskStatus(displayTaskIndex, displayMacroIndex);
      }
    });
    
    let dueDateDisplay = '';
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = task.status !== 'completed' && dueDate < today;
      dueDateDisplay = `
        <div class="meta-item ${isOverdue ? 'text-danger' : ''}">
          <i class="fas fa-calendar${isOverdue ? '-times' : ''}"></i> 
          ${formatDate(task.dueDate)}
        </div>
      `;
    }
    
    taskEl.innerHTML = `
      <div class="board-task-title">
        ${task.name}
      </div>
      ${selectedMacroIndex === -1 && task.macroName ? `<small class="text-muted d-block mb-1">${task.macroName}</small>` : ''}
      ${task.details ? `<div class="board-task-desc">${truncateText(task.details, 40)}</div>` : ''}
      <div class="board-task-meta">
        ${dueDateDisplay}
        ${task.assignee ? `
          <div class="meta-item">
            <i class="fas fa-user"></i> ${task.assignee}
          </div>
        ` : ''}
        <div class="task-actions"> 
          <!-- Eye icon button removed -->
          <button type="button" class="task-action-btn" onclick="editTask(${displayTaskIndex}, ${displayMacroIndex}); event.stopPropagation();">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </div>
    `;
    column.appendChild(taskEl);
  });
}

// Filter and View Management
function filterTasks(searchTerm) { 
  renderTasks(); 
}

function applyFilter(filterType) {
  currentTaskFilter = filterType;
  renderTasks();
}

function filterTasksByCurrentFilter(tasks) { 
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  let filteredTasks = [...tasks]; 

  if (searchTerm) {
    filteredTasks = filteredTasks.filter(task => 
      task.name.toLowerCase().includes(searchTerm) || 
      (task.details && task.details.toLowerCase().includes(searchTerm)) ||
      (task.assignee && task.assignee.toLowerCase().includes(searchTerm)) ||
      (task.macroName && task.macroName.toLowerCase().includes(searchTerm)) 
    );
  }
  
  switch (currentTaskFilter) {
    case 'pending':
      return filteredTasks.filter(task => task.status === 'pending');
    case 'completed':
      return filteredTasks.filter(task => task.status === 'completed');
    case 'overdue':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return filteredTasks.filter(task => 
        task.status !== 'completed' && 
        task.dueDate && 
        new Date(task.dueDate) < today
      );
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return filteredTasks.filter(task => 
        task.dueDate && 
        new Date(task.dueDate) >= todayStart && 
        new Date(task.dueDate) <= todayEnd
      );
    case 'week':
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);
      return filteredTasks.filter(task => 
        task.dueDate && 
        new Date(task.dueDate) >= weekStart && 
        new Date(task.dueDate) <= weekEnd
      );
    default: // 'all'
      return filteredTasks;
  }
}

function changeViewMode(viewMode) {
  if (viewMode === currentViewMode) return;
  currentViewMode = viewMode;
  document.querySelectorAll('.view-option').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewMode);
  });
  document.querySelectorAll('.task-view').forEach(view => {
    view.classList.toggle('active', view.id === (viewMode === 'list' ? 'listView' : 'boardView'));
  });
  renderTasks();
  localStorage.setItem('viewMode', viewMode);
}

// Update Statistics
function updateStats() {
  document.getElementById('totalMacroCount').textContent = macros.length;
  const completedMacros = macros.filter(macro => {
    const totalTasks = macro.tasks.length;
    if (totalTasks === 0) return false; 
    const completedTasksInMacro = macro.tasks.filter(task => task.status === 'completed').length;
    return totalTasks === completedTasksInMacro;
  }).length;
  const completedRate = macros.length > 0 ? Math.round((completedMacros / macros.length) * 100) : 0;
  document.getElementById('completedMacroRate').textContent = `${completedRate}%`;

  let tasksForStats = [];
  if (selectedMacroIndex === -1) { 
    tasksForStats = getAggregatedTasks();
  } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) { 
    tasksForStats = macros[selectedMacroIndex].tasks;
  }

  const totalTasks = tasksForStats.length;
  const completedTasks = tasksForStats.filter(task => task.status === 'completed').length;
  const pendingTasks = tasksForStats.filter(task => task.status === 'pending' || task.status === 'in-progress').length; 
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasksForStats.filter(task => 
    task.status !== 'completed' && 
    task.dueDate && 
    new Date(task.dueDate) < today
  ).length;
  
  document.getElementById('totalTaskCount').textContent = totalTasks;
  document.getElementById('completedTaskCount').textContent = completedTasks;
  document.getElementById('pendingTaskCount').textContent = pendingTasks;
  document.getElementById('overdueTaskCount').textContent = overdueTasks;
}


// Analytics Charts
function renderAnalyticsCharts() {
  destroyCharts();
  
  let tasksForCharts = [];
  let chartTitlePrefix = "";

  if (selectedMacroIndex === -1) {
    tasksForCharts = getAggregatedTasks();
    chartTitlePrefix = "Geral - ";
    renderOverallCharts(tasksForCharts); 
  } else if (selectedMacroIndex !== null && macros[selectedMacroIndex]) {
    tasksForCharts = macros[selectedMacroIndex].tasks;
    chartTitlePrefix = `${macros[selectedMacroIndex].name} - `;
    renderMacroCharts(macros[selectedMacroIndex], chartTitlePrefix); 
  } else {
      return;
  }
}

function destroyCharts() {
  const chartIds = ['progressChart', 'statusChart', 'completionTrendChart']; 
  chartIds.forEach(id => {
    const chartCanvas = document.getElementById(id);
    if (chartCanvas) {
        const chartInstance = Chart.getChart(chartCanvas);
        if (chartInstance) {
        chartInstance.destroy();
        }
    }
  });
}

function renderOverallCharts(allTasks) { 
  const totalTasksCount = allTasks.length;
  const completedTasksCount = allTasks.filter(task => task.status === 'completed').length;
  const pendingTasksCount = totalTasksCount - completedTasksCount;
  
  new Chart(document.getElementById('progressChart'), {
    type: 'doughnut',
    data: {
      labels: ['Concluídas', 'Pendentes'],
      datasets: [{ data: [completedTasksCount, pendingTasksCount], backgroundColor: ['#4CAF50', '#FFC107'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Progresso Geral de Tarefas', color: '#E3E6ED' }, legend: { position: 'bottom', labels: { color: '#E3E6ED' } } } }
  });
  
  const pendingStatusTasks = allTasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = allTasks.filter(task => task.status === 'in-progress').length;

  new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: {
      labels: ['Pendentes', 'Em Progresso', 'Concluídas'],
      datasets: [{ data: [pendingStatusTasks, inProgressTasks, completedTasksCount], backgroundColor: ['#FFC107', '#FF9800', '#4CAF50'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Todas as Tarefas por Status', color: '#E3E6ED' }, legend: { position: 'bottom', labels: { color: '#E3E6ED' } } } }
  });
  
  const macroNames = macros.map(macro => macro.name);
  const macroCompletionRates = macros.map(macro => {
    const total = macro.tasks.length;
    if (total === 0) return 0;
    const completed = macro.tasks.filter(task => task.status === 'completed').length;
    return Math.round((completed / total) * 100);
  });
  
  new Chart(document.getElementById('completionTrendChart'), {
    type: 'line',
    data: {
      labels: macroNames,
      datasets: [{ label: 'Taxa de Conclusão por Macro (%)', data: macroCompletionRates, borderColor: '#3399FF', backgroundColor: 'rgba(51,153,255,0.2)', borderWidth: 2, fill: true, tension: 0.4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#E3E6ED' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: '#E3E6ED', maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { title: { display: true, text: 'Taxa de Conclusão por Macro', color: '#E3E6ED' }, legend: { labels: { color: '#E3E6ED' } } } }
  });
}

function renderMacroCharts(macro, titlePrefix = "") { 
  const totalTasks = macro.tasks.length;
  const completedTasks = macro.tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  
  new Chart(document.getElementById('progressChart'), {
    type: 'doughnut',
    data: { labels: ['Concluídas', 'Pendentes'], datasets: [{ data: [completedTasks, pendingTasks], backgroundColor: ['#4CAF50', '#FFC107'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `${titlePrefix}Progresso da Macro`, color: '#E3E6ED' }, legend: { position: 'bottom', labels: { color: '#E3E6ED' } } } }
  });
  
  const pendingStatusTasks = macro.tasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = macro.tasks.filter(task => task.status === 'in-progress').length;

  new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: { labels: ['Pendentes', 'Em Progresso', 'Concluídas'], datasets: [{ data: [pendingStatusTasks, inProgressTasks, completedTasks], backgroundColor: ['#FFC107', '#FF9800', '#4CAF50'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `${titlePrefix}Tarefas por Status`, color: '#E3E6ED' }, legend: { position: 'bottom', labels: { color: '#E3E6ED' } } } }
  });
  
  const tasksByWeek = {};
  macro.tasks.forEach(task => {
    const date = new Date(task.createdAt);
    const weekNumber = getWeekNumber(date);
    const weekLabel = `Semana ${weekNumber}`;
    if (!tasksByWeek[weekLabel]) tasksByWeek[weekLabel] = { total: 0, completed: 0 };
    tasksByWeek[weekLabel].total++;
    if (task.status === 'completed') tasksByWeek[weekLabel].completed++;
  });
  const weekLabels = Object.keys(tasksByWeek).sort();
  const completionRates = weekLabels.map(week => {
    const weekData = tasksByWeek[week];
    return weekData.total > 0 ? Math.round((weekData.completed / weekData.total) * 100) : 0;
  });
  
  new Chart(document.getElementById('completionTrendChart'), {
    type: 'line',
    data: { labels: weekLabels, datasets: [{ label: 'Taxa de Conclusão (%)', data: completionRates, borderColor: '#3399FF', backgroundColor: 'rgba(51,153,255,0.2)', borderWidth: 2, fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#E3E6ED' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: '#E3E6ED' }, grid: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { title: { display: true, text: `${titlePrefix}Tendência de Conclusão Semanal`, color: '#E3E6ED' }, legend: { labels: { color: '#E3E6ED' } } } }
  });
}

// Utility Functions
function formatDate(dateString) {
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000; 
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getStatusLabel(status) {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'in-progress': return 'Em Progresso';
    case 'completed': return 'Concluída';
    default: return 'Pendente';
  }
}

// Show confirm modal
let confirmCallback = null;
function showConfirmModal(message, callback) {
  const confirmModalBody = document.getElementById('confirmModalBody');
  if(confirmModalBody) confirmModalBody.textContent = message;
  confirmCallback = callback;
  if(confirmModal) confirmModal.show();
}

// Show edit modal
let editCallback = null;
function showEditModal(currentValue, callback) {
  const confirmModalLabel = document.getElementById('confirmModalLabel');
  const confirmModalBody = document.getElementById('confirmModalBody');

  if(confirmModalLabel) confirmModalLabel.textContent = 'Editar';
  if(confirmModalBody) confirmModalBody.innerHTML = `
    <input type="text" id="editInput" class="form-control" value="${currentValue}" 
      style="background-color: var(--card-color); color: var(--text-color); border: 1px solid var(--border-color);">
  `;
  
  editCallback = callback;
  if(confirmModal) confirmModal.show();
  
  const editInput = document.getElementById('editInput');
  if(editInput) {
    editInput.focus();
    editInput.select();
    
    const keyHandler = function(e) {
      if (e.key === 'Enter') {
        const newValue = editInput.value.trim();
        if (newValue && typeof editCallback === 'function') {
          editCallback(newValue);
        }
        if(confirmModal) confirmModal.hide();
        editInput.removeEventListener('keydown', keyHandler);
      }
    };
    editInput.addEventListener('keydown', keyHandler);
  }
  
  const originalConfirmModalBtnAction = document.getElementById('confirmModalBtn').onclick;
  document.getElementById('confirmModalBtn').onclick = function() {
    const newValue = document.getElementById('editInput')?.value.trim();
    if (newValue && typeof editCallback === 'function') {
        editCallback(newValue);
    }
    if(confirmModal) confirmModal.hide();
    document.getElementById('confirmModalBtn').onclick = originalConfirmModalBtnAction || function() { if(confirmModal) confirmModal.hide(); };
  };
}


// Import/Export Functions
function exportData() {
  const dataStr = JSON.stringify(macros, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = `marketing_tasks_${new Date().toISOString().slice(0, 10)}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!Array.isArray(importedData)) throw new Error('Formato de dados inválido.');
      
      showConfirmModal('Esta ação irá substituir todos os dados atuais. Deseja continuar?', function() {
        macros = importedData;
        macros.forEach(macro => {
          if (!macro.tasks) macro.tasks = [];
          macro.tasks.forEach(task => {
            if (!task.id) task.id = generateId();
            if (!task.status) task.status = 'pending';
            if (!task.createdAt) task.createdAt = new Date().toISOString();
            if (task.assignee === undefined) task.assignee = '';
            delete task.priority; 
          });
        });
        saveData();
        renderMacros();
        selectGlobalView('allTasks'); 
      });
    } catch (error) {
      alert('Erro ao importar dados: ' + error.message);
    }
    if(event.target) event.target.value = '';
  };
  reader.readAsText(file);
}

// Clear completed tasks
function clearCompletedTasks() {
  const confirmMessage = (selectedMacroIndex === -1 || selectedMacroIndex === null)
    ? 'Deseja resetar TODAS as tarefas concluídas para pendentes em TODAS as macro tarefas?'
    : `Deseja resetar todas as tarefas concluídas para pendentes em "${macros[selectedMacroIndex].name}"?`;

  showConfirmModal(confirmMessage, function() {
    const macrosToProcess = (selectedMacroIndex === -1 || selectedMacroIndex === null) ? macros : [macros[selectedMacroIndex]];
    macrosToProcess.forEach(macro => {
      if (macro && macro.tasks) {
        macro.tasks.forEach(task => {
          if (task.status === 'completed') {
            task.status = 'pending';
            delete task.completedAt;
          }
        });
      }
    });
    saveData();
    renderMacros(); 
    renderTasks();
  });
}
