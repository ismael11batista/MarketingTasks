// Global variables
let macros = [];
let selectedMacroIndex = null;
let currentTaskFilter = 'all';
let currentViewMode = 'list';
let boardSortables = [];

// Initialize modals
const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
const taskFormModal = new bootstrap.Modal(document.getElementById('taskFormModal'));
const analyticsModal = new bootstrap.Modal(document.getElementById('analyticsModal'));

// Initialize flatpickr for date picker
const datePicker = flatpickr("#taskDueDate", {
  locale: "pt",
  dateFormat: "d/m/Y",
  allowInput: true,
  minDate: "today"
});

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  loadData();
  setupEventListeners();
  setupDragAndDrop();
  updateStats();
  
  // Check if there's a selected macro saved in localStorage
  const lastSelectedMacroIndex = localStorage.getItem('selectedMacroIndex');
  if (lastSelectedMacroIndex !== null && macros[lastSelectedMacroIndex]) {
    selectMacro(parseInt(lastSelectedMacroIndex));
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
      if (taskName && selectedMacroIndex !== null) {
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
  
  // Toggle sidebar
  document.getElementById('toggleSidebar').addEventListener('click', function() {
    const sidebar = document.getElementById('macroSidebar');
    sidebar.classList.toggle('collapsed');
    
    // Save sidebar state to localStorage
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  });
  
  // Load sidebar state from localStorage
  const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (sidebarCollapsed) {
    document.getElementById('macroSidebar').classList.add('collapsed');
  }
  
  // Analytics modal shown event
  document.getElementById('analyticsModal').addEventListener('shown.bs.modal', function() {
    renderAnalyticsCharts();
  });
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  // For the task list
  const taskList = document.getElementById('taskList');
  new Sortable(taskList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: function(evt) {
      const taskId = evt.item.getAttribute('data-id');
      const newIndex = evt.newIndex;
      
      // Reorder tasks in the data
      if (selectedMacroIndex !== null) {
        const tasks = macros[selectedMacroIndex].tasks;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
          const [movedTask] = tasks.splice(taskIndex, 1);
          tasks.splice(newIndex, 0, movedTask);
          saveData();
        }
      }
    }
  });
  
  // Setup board view sortables
  setupBoardSortables();
}

// Setup sortables for board columns
function setupBoardSortables() {
  // Clear existing sortables
  boardSortables.forEach(sortable => sortable.destroy());
  boardSortables = [];
  
  // Create new sortables for each column
  const columns = ['pendingTasks', 'inProgressTasks', 'completedTasks'];
  columns.forEach(columnId => {
    const column = document.getElementById(columnId);
    const sortable = new Sortable(column, {
      group: 'tasks',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function(evt) {
        // Handle task movement between columns
        const taskId = evt.item.getAttribute('data-id');
        const newColumn = evt.to.id;
        
        if (selectedMacroIndex !== null && taskId) {
          const tasks = macros[selectedMacroIndex].tasks;
          const taskIndex = tasks.findIndex(t => t.id === taskId);
          
          if (taskIndex !== -1) {
            // Update task status based on the new column
            let newStatus = 'pending';
            if (newColumn === 'inProgressTasks') newStatus = 'in-progress';
            else if (newColumn === 'completedTasks') newStatus = 'completed';
            
            tasks[taskIndex].status = newStatus;
            saveData();
            updateStats();
          }
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
      // Ensure all tasks have required properties
      macros.forEach(macro => {
        if (!macro.tasks) macro.tasks = [];
        macro.tasks.forEach(task => {
          if (!task.id) task.id = generateId();
          if (!task.status) task.status = 'pending';
          if (!task.priority) task.priority = 'medium';
          if (!task.createdAt) task.createdAt = new Date().toISOString();
        });
      });
      renderMacros();
    } catch (error) {
      console.error('Error loading data:', error);
      macros = [];
    }
  }
}

function saveData() {
  localStorage.setItem('marketingTasks', JSON.stringify(macros));
  updateStats();
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
    saveData();
    renderMacros();
    
    // Select the newly created macro
    selectMacro(macros.length - 1);
    
    // Clear the input
    input.value = '';
  }
}

function editMacro(index) {
  if (macros[index]) {
    showEditModal(macros[index].name, function(newName) {
      if (newName) {
        macros[index].name = newName;
        saveData();
        renderMacros();
        
        // Update the selected macro title if it's the currently selected one
        if (selectedMacroIndex === index) {
          document.getElementById('selectedMacroTitle').textContent = newName;
        }
      }
    });
  }
}

function deleteMacro(index) {
  if (macros[index]) {
    showConfirmModal(`Tem certeza que deseja excluir a macro "${macros[index].name}" e todas as suas tarefas?`, function() {
      // If the deleted macro is the selected one, clear the selection
      if (selectedMacroIndex === index) {
        selectedMacroIndex = null;
        document.getElementById('selectedMacroTitle').textContent = 'Selecione uma Macro Tarefa';
        document.getElementById('taskList').innerHTML = '';
        document.getElementById('newTaskInput').disabled = true;
        document.getElementById('showTaskFormBtn').disabled = true;
        renderBoardView();
      } else if (selectedMacroIndex > index) {
        // Adjust the selected index if a macro before it is removed
        selectedMacroIndex--;
      }
      
      macros.splice(index, 1);
      saveData();
      renderMacros();
    });
  }
}

function selectMacro(index) {
  if (macros[index]) {
    selectedMacroIndex = index;
    
    // Update the macro selection in the UI
    const macroItems = document.querySelectorAll('.macro-item');
    macroItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Update the title
    document.getElementById('selectedMacroTitle').textContent = macros[index].name;
    
    // Enable the task input
    document.getElementById('newTaskInput').disabled = false;
    document.getElementById('showTaskFormBtn').disabled = false;
    
    // Save the selected macro index to localStorage
    localStorage.setItem('selectedMacroIndex', index);
    
    // Render the tasks
    renderTasks();
  } else {
    // Invalid selection
    selectedMacroIndex = null;
    document.getElementById('selectedMacroTitle').textContent = 'Selecione uma Macro Tarefa';
    document.getElementById('newTaskInput').disabled = true;
    document.getElementById('showTaskFormBtn').disabled = true;
    renderTasks();
  }
}

// Task Management Functions
function addQuickTask(taskName) {
  if (selectedMacroIndex !== null) {
    const newTask = {
      id: generateId(),
      name: taskName,
      details: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      priority: 'medium'
    };
    
    macros[selectedMacroIndex].tasks.push(newTask);
    saveData();
    renderTasks();
    
    // Clear the input
    document.getElementById('newTaskInput').value = '';
  }
}

function toggleTaskStatus(taskIndex, macroIndexOverride = null) {
  // Determine which macro to use
  const macroIndex = macroIndexOverride !== null ? macroIndexOverride : selectedMacroIndex;
  
  if (macroIndex !== null && macros[macroIndex] && macros[macroIndex].tasks[taskIndex]) {
    const task = macros[macroIndex].tasks[taskIndex];
    
    // Toggle between pending, in-progress, and completed
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
    renderTasks();
  }
}

function editTask(taskIndex) {
  if (selectedMacroIndex !== null && macros[selectedMacroIndex].tasks[taskIndex]) {
    const task = macros[selectedMacroIndex].tasks[taskIndex];
    
    // Populate the task form
    document.getElementById('taskTitle').value = task.name || '';
    document.getElementById('taskDescription').value = task.details || '';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    document.getElementById('taskStatus').value = task.status || 'pending';
    document.getElementById('taskAssignee').value = task.assignee || '';
    
    // Set due date if exists
    if (task.dueDate) {
      datePicker.setDate(new Date(task.dueDate));
    } else {
      datePicker.clear();
    }
    
    // Change form title
    document.getElementById('taskFormModalLabel').textContent = 'Editar Tarefa';
    
    // Store the task index for reference when saving
    document.getElementById('taskForm').setAttribute('data-task-index', taskIndex);
    
    // Show the modal
    taskFormModal.show();
  }
}

function deleteTask(taskIndex) {
  if (selectedMacroIndex !== null && macros[selectedMacroIndex].tasks[taskIndex]) {
    const task = macros[selectedMacroIndex].tasks[taskIndex];
    
    showConfirmModal(`Tem certeza que deseja excluir a tarefa "${task.name}"?`, function() {
      macros[selectedMacroIndex].tasks.splice(taskIndex, 1);
      saveData();
      renderTasks();
    });
  }
}

function showTaskDetails(taskIndex) {
  if (selectedMacroIndex !== null && macros[selectedMacroIndex].tasks[taskIndex]) {
    const task = macros[selectedMacroIndex].tasks[taskIndex];
    
    // Create a card modal to show task details
    let detailsHTML = `
      <div class="task-detail-card">
        <h5>${task.name}</h5>
        <div class="detail-meta">
          <div class="meta-item">
            <i class="fas fa-clock"></i> 
            Criado em: ${formatDate(task.createdAt)}
          </div>
          ${task.dueDate ? `
            <div class="meta-item">
              <i class="fas fa-calendar"></i> 
              Prazo: ${formatDate(task.dueDate)}
            </div>
          ` : ''}
          <div class="meta-item">
            <i class="fas fa-signal"></i> 
            Prioridade: ${getPriorityLabel(task.priority)}
          </div>
          ${task.assignee ? `
            <div class="meta-item">
              <i class="fas fa-user"></i> 
              Responsável: ${task.assignee}
            </div>
          ` : ''}
          <div class="meta-item">
            <i class="fas fa-tasks"></i> 
            Status: ${getStatusLabel(task.status)}
          </div>
          ${task.completedAt ? `
            <div class="meta-item">
              <i class="fas fa-check-circle"></i> 
              Concluído em: ${formatDate(task.completedAt)}
            </div>
          ` : ''}
        </div>
        <div class="detail-description">
          <h6>Descrição:</h6>
          <p>${task.details || 'Sem descrição'}</p>
        </div>
      </div>
    `;
    
    document.getElementById('confirmModalLabel').textContent = 'Detalhes da Tarefa';
    document.getElementById('confirmModalBody').innerHTML = detailsHTML;
    document.getElementById('confirmModalBtn').style.display = 'none';
    
    confirmModal.show();
    
    // Add a hidden event to restore the confirm button when the modal is hidden
    document.getElementById('confirmModal').addEventListener('hidden.bs.modal', function onHidden() {
      document.getElementById('confirmModalBtn').style.display = 'block';
      document.getElementById('confirmModalLabel').textContent = 'Confirmação';
      document.getElementById('confirmModalBody').innerHTML = '';
      
      // Remove this event listener to avoid multiple registrations
      document.getElementById('confirmModal').removeEventListener('hidden.bs.modal', onHidden);
    });
  }
}

// Task Form Management
function resetTaskForm() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskForm').removeAttribute('data-task-index');
  datePicker.clear();
}

function saveTaskForm() {
  const taskTitle = document.getElementById('taskTitle').value.trim();
  
  if (!taskTitle || selectedMacroIndex === null) return;
  
  const taskIndex = document.getElementById('taskForm').getAttribute('data-task-index');
  const isEditing = taskIndex !== null && taskIndex !== undefined;
  
  const taskData = {
    id: isEditing ? macros[selectedMacroIndex].tasks[taskIndex].id : generateId(),
    name: taskTitle,
    details: document.getElementById('taskDescription').value.trim(),
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value,
    assignee: document.getElementById('taskAssignee').value.trim(),
    createdAt: isEditing ? macros[selectedMacroIndex].tasks[taskIndex].createdAt : new Date().toISOString()
  };
  
  // Add due date if selected
  const dueDateInput = document.getElementById('taskDueDate').value;
  if (dueDateInput) {
    const dueDate = datePicker.selectedDates[0];
    if (dueDate) {
      taskData.dueDate = dueDate.toISOString();
    }
  }
  
  // Add or update the task
  if (isEditing) {
    // Preserve the completedAt property if it exists
    if (macros[selectedMacroIndex].tasks[taskIndex].completedAt) {
      taskData.completedAt = macros[selectedMacroIndex].tasks[taskIndex].completedAt;
    }
    
    // Update task
    macros[selectedMacroIndex].tasks[taskIndex] = taskData;
  } else {
    // Add new task
    macros[selectedMacroIndex].tasks.push(taskData);
  }
  
  saveData();
  renderTasks();
  taskFormModal.hide();
}

// UI Rendering Functions
function renderMacros() {
  const macroList = document.getElementById('macroList');
  macroList.innerHTML = '';
  

  
  // Add regular macros
  macros.forEach((macro, index) => {
    // Calculate progress
    const totalTasks = macro.tasks.length;
    const completedTasks = macro.tasks.filter(task => task.status === 'completed').length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Get macro initials for collapsed sidebar
    const initials = macro.name.split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    const isCompleted = totalTasks > 0 && completedTasks === totalTasks;
    
    const macroItem = document.createElement('li');
    macroItem.className = `macro-item ${selectedMacroIndex === index ? 'active' : ''} ${isCompleted ? 'completed-macro' : ''}`;
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
  
  updateStats();
}

function renderTasks() {
  if (selectedMacroIndex === null) return;
  
  // Render based on current view mode
  if (currentViewMode === 'list') {
    renderListView();
  } else {
    renderBoardView();
  }
  
  updateStats();
}

function renderListView() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  
  if (selectedMacroIndex === null || !macros[selectedMacroIndex]) return;
  
  // Get tasks from selected macro
  let tasks = [...macros[selectedMacroIndex].tasks];
  
  // Apply current filter
  tasks = filterTasksByCurrentFilter(tasks);
  
  if (tasks.length === 0) {
    return;
  }
  
  tasks.forEach((task, index) => {
    // Create the task item
    const listItem = document.createElement('li');
    listItem.className = `list-group-item ${task.status === 'completed' ? 'task-done' : ''}`;
    listItem.setAttribute('data-id', task.id);
    
    // Make the whole task item clickable to toggle status
    listItem.addEventListener('click', function(e) {
      // Prevent triggering when clicking on action buttons or checkbox
      if (!e.target.closest('.task-actions') && !e.target.closest('.form-check-input')) {
        toggleTaskStatus(index);
      }
    });
    
    // Format due date if exists
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
            onchange="toggleTaskStatus(${index})">
        </div>
        <div class="task-content">
          <div class="task-title">${task.name}</div>
          ${selectedMacroIndex === -1 && task.macroName ? `
            <div class="task-macro"><i class="fas fa-layer-group"></i> ${task.macroName}</div>
          ` : ''}
          ${task.details ? `<div class="task-details">${truncateText(task.details, 60)}</div>` : ''}
          <div class="task-meta">
            <div class="meta-item">
              <span class="priority-badge priority-${task.priority}"></span>
              ${getPriorityLabel(task.priority)}
            </div>
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
        <button type="button" onclick="showTaskDetails(${index})">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" onclick="editTask(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="delete" onclick="deleteTask(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    taskList.appendChild(listItem);
  });
}

function renderBoardView() {
  // Clear board columns
  document.getElementById('pendingTasks').innerHTML = '';
  document.getElementById('inProgressTasks').innerHTML = '';
  document.getElementById('completedTasks').innerHTML = '';
  
  if (selectedMacroIndex === null || !macros[selectedMacroIndex]) return;
  
  // Get tasks from selected macro
  let tasks = [...macros[selectedMacroIndex].tasks];
  
  // Apply current filter
  tasks = filterTasksByCurrentFilter(tasks);
  
  // Group tasks by status
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  
  // Render each column
  renderBoardColumn('pendingTasks', pendingTasks);
  renderBoardColumn('inProgressTasks', inProgressTasks);
  renderBoardColumn('completedTasks', completedTasks);
  
  // Re-initialize drag and drop for the board view
  setupBoardSortables();
}

function renderBoardColumn(columnId, tasks) {
  const column = document.getElementById(columnId);
  column.innerHTML = ''; // Limpa a coluna primeiro
  
  if (tasks.length === 0) {
    return;
  }
  
  tasks.forEach(task => {
    // Get the original task index
    const taskIndex = macros[selectedMacroIndex].tasks.findIndex(t => t.id === task.id);
    
    // Create the task item
    const taskEl = document.createElement('div');
    taskEl.className = 'board-task';
    taskEl.setAttribute('data-id', task.id);
    
    // Make the whole task clickable to toggle status
    taskEl.addEventListener('click', function(e) {
      // Prevent triggering when clicking on action buttons
      if (!e.target.closest('.task-action-btn')) {
        toggleTaskStatus(taskIndex);
      }
    });
    
    // Format due date if exists
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
        <div class="priority-badge priority-${task.priority}"></div>
      </div>
      ${task.details ? `<div class="board-task-desc">${truncateText(task.details, 40)}</div>` : ''}
      <div class="board-task-meta">
        ${dueDateDisplay}
        ${task.assignee ? `
          <div class="meta-item">
            <i class="fas fa-user"></i> ${task.assignee}
          </div>
        ` : ''}
        <div class="task-actions">
          <button type="button" onclick="showTaskDetails(${taskIndex})">
            <i class="fas fa-eye"></i>
          </button>
          <button type="button" onclick="editTask(${taskIndex})">
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
  // Apply search filter on top of the current category filter
  renderTasks();
}

function applyFilter(filterType) {
  currentTaskFilter = filterType;
  renderTasks();
}

function filterTasksByCurrentFilter(tasks) {
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  
  // First filter by search term if any
  if (searchTerm) {
    tasks = tasks.filter(task => 
      task.name.toLowerCase().includes(searchTerm) || 
      (task.details && task.details.toLowerCase().includes(searchTerm)) ||
      (task.assignee && task.assignee.toLowerCase().includes(searchTerm))
    );
  }
  
  // Then apply category filter
  switch (currentTaskFilter) {
    case 'pending':
      return tasks.filter(task => task.status === 'pending');
    case 'completed':
      return tasks.filter(task => task.status === 'completed');
    case 'overdue':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tasks.filter(task => 
        task.status !== 'completed' && 
        task.dueDate && 
        new Date(task.dueDate) < today
      );
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return tasks.filter(task => 
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
      return tasks.filter(task => 
        task.dueDate && 
        new Date(task.dueDate) >= weekStart && 
        new Date(task.dueDate) <= weekEnd
      );
    case 'highPriority':
      return tasks.filter(task => task.priority === 'high');
    default:
      return tasks;
  }
}

function changeViewMode(viewMode) {
  if (viewMode === currentViewMode) return;
  
  currentViewMode = viewMode;
  
  // Update view mode buttons
  document.querySelectorAll('.view-option').forEach(btn => {
    if (btn.getAttribute('data-view') === viewMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update the visible view
  document.querySelectorAll('.task-view').forEach(view => {
    view.classList.remove('active');
  });
  
  document.getElementById(viewMode === 'list' ? 'listView' : 'boardView').classList.add('active');
  
  // Render tasks with the new view
  renderTasks();
  
  // Save the view mode preference
  localStorage.setItem('viewMode', viewMode);
}

// Update Statistics
function updateStats() {
  // Macro Stats
  document.getElementById('totalMacroCount').textContent = macros.length;
  
  const completedMacros = macros.filter(macro => {
    const totalTasks = macro.tasks.length;
    const completedTasks = macro.tasks.filter(task => task.status === 'completed').length;
    return totalTasks > 0 && totalTasks === completedTasks;
  }).length;
  
  const completedRate = macros.length > 0 ? Math.round((completedMacros / macros.length) * 100) : 0;
  document.getElementById('completedMacroRate').textContent = `${completedRate}%`;
  
  // Task Stats (for selected macro)
  if (selectedMacroIndex !== null && macros[selectedMacroIndex]) {
    const tasks = macros[selectedMacroIndex].tasks;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const pendingTasks = tasks.filter(task => task.status === 'pending').length;
    
    // Count overdue tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = tasks.filter(task => 
      task.status !== 'completed' && 
      task.dueDate && 
      new Date(task.dueDate) < today
    ).length;
    
    // Update counters
    document.getElementById('totalTaskCount').textContent = totalTasks;
    document.getElementById('completedTaskCount').textContent = completedTasks;
    document.getElementById('pendingTaskCount').textContent = pendingTasks;
    document.getElementById('overdueTaskCount').textContent = overdueTasks;
  } else {
    // Clear counters when no macro selected
    document.getElementById('totalTaskCount').textContent = '0';
    document.getElementById('completedTaskCount').textContent = '0';
    document.getElementById('pendingTaskCount').textContent = '0';
    document.getElementById('overdueTaskCount').textContent = '0';
  }
}

// Analytics Charts
function renderAnalyticsCharts() {
  // Clear any existing charts
  destroyCharts();
  
  if (selectedMacroIndex === null) {
    // If no macro selected, show overall stats
    renderOverallCharts();
  } else {
    // Show selected macro stats
    renderMacroCharts(macros[selectedMacroIndex]);
  }
}

function destroyCharts() {
  const chartIds = ['progressChart', 'priorityChart', 'statusChart', 'completionTrendChart'];
  chartIds.forEach(id => {
    const chartCanvas = document.getElementById(id);
    const chartInstance = Chart.getChart(chartCanvas);
    if (chartInstance) {
      chartInstance.destroy();
    }
  });
}

function renderOverallCharts() {
  // Progress Chart (donut)
  const totalTasks = macros.reduce((sum, macro) => sum + macro.tasks.length, 0);
  const completedTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.status === 'completed').length, 0);
  const pendingTasks = totalTasks - completedTasks;
  
  new Chart(document.getElementById('progressChart'), {
    type: 'doughnut',
    data: {
      labels: ['Concluídas', 'Pendentes'],
      datasets: [{
        data: [completedTasks, pendingTasks],
        backgroundColor: [
          '#4CAF50',
          '#FFC107'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
  });
  
  // Tasks by Priority
  const highPriorityTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.priority === 'high').length, 0);
  const mediumPriorityTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.priority === 'medium').length, 0);
  const lowPriorityTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.priority === 'low').length, 0);
  
  new Chart(document.getElementById('priorityChart'), {
    type: 'bar',
    data: {
      labels: ['Alta', 'Média', 'Baixa'],
      datasets: [{
        label: 'Tarefas por Prioridade',
        data: [highPriorityTasks, mediumPriorityTasks, lowPriorityTasks],
        backgroundColor: [
          '#FF4C4C',
          '#FFC107',
          '#4CAF50'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Tasks by Status
  const pendingStatusTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.status === 'pending').length, 0);
  const inProgressTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.status === 'in-progress').length, 0);
  const completedStatusTasks = macros.reduce((sum, macro) => 
    sum + macro.tasks.filter(task => task.status === 'completed').length, 0);
  
  new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: {
      labels: ['Pendentes', 'Em Progresso', 'Concluídas'],
      datasets: [{
        data: [pendingStatusTasks, inProgressTasks, completedStatusTasks],
        backgroundColor: [
          '#FFC107',
          '#FF9800',
          '#4CAF50'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
  });
  
  // Macro Completion
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
      datasets: [{
        label: 'Taxa de Conclusão (%)',
        data: macroCompletionRates,
        borderColor: '#3399FF',
        backgroundColor: 'rgba(51, 153, 255, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#E3E6ED',
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
  });
}

function renderMacroCharts(macro) {
  // Progress Chart (donut)
  const totalTasks = macro.tasks.length;
  const completedTasks = macro.tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = totalTasks - completedTasks;
  
  new Chart(document.getElementById('progressChart'), {
    type: 'doughnut',
    data: {
      labels: ['Concluídas', 'Pendentes'],
      datasets: [{
        data: [completedTasks, pendingTasks],
        backgroundColor: [
          '#4CAF50',
          '#FFC107'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
  });
  
  // Tasks by Priority
  const highPriorityTasks = macro.tasks.filter(task => task.priority === 'high').length;
  const mediumPriorityTasks = macro.tasks.filter(task => task.priority === 'medium').length;
  const lowPriorityTasks = macro.tasks.filter(task => task.priority === 'low').length;
  
  new Chart(document.getElementById('priorityChart'), {
    type: 'bar',
    data: {
      labels: ['Alta', 'Média', 'Baixa'],
      datasets: [{
        label: 'Tarefas por Prioridade',
        data: [highPriorityTasks, mediumPriorityTasks, lowPriorityTasks],
        backgroundColor: [
          '#FF4C4C',
          '#FFC107',
          '#4CAF50'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Tasks by Status
  const pendingStatusTasks = macro.tasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = macro.tasks.filter(task => task.status === 'in-progress').length;
  const completedStatusTasks = macro.tasks.filter(task => task.status === 'completed').length;
  
  new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: {
      labels: ['Pendentes', 'Em Progresso', 'Concluídas'],
      datasets: [{
        data: [pendingStatusTasks, inProgressTasks, completedStatusTasks],
        backgroundColor: [
          '#FFC107',
          '#FF9800',
          '#4CAF50'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
  });
  
  // Completion Trend
  // Group tasks by creation dates (by week)
  const tasksByWeek = {};
  macro.tasks.forEach(task => {
    const date = new Date(task.createdAt);
    const weekNumber = getWeekNumber(date);
    const weekLabel = `Semana ${weekNumber}`;
    
    if (!tasksByWeek[weekLabel]) {
      tasksByWeek[weekLabel] = {
        total: 0,
        completed: 0
      };
    }
    
    tasksByWeek[weekLabel].total++;
    if (task.status === 'completed') {
      tasksByWeek[weekLabel].completed++;
    }
  });
  
  const weekLabels = Object.keys(tasksByWeek).sort();
  const completionRates = weekLabels.map(week => {
    const weekData = tasksByWeek[week];
    return weekData.total > 0 ? Math.round((weekData.completed / weekData.total) * 100) : 0;
  });
  
  new Chart(document.getElementById('completionTrendChart'), {
    type: 'line',
    data: {
      labels: weekLabels,
      datasets: [{
        label: 'Taxa de Conclusão (%)',
        data: completionRates,
        borderColor: '#3399FF',
        backgroundColor: 'rgba(51, 153, 255, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#E3E6ED'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#E3E6ED'
          }
        }
      }
    }
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
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 'high': return 'Alta';
    case 'medium': return 'Média';
    case 'low': return 'Baixa';
    default: return 'Média';
  }
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
  document.getElementById('confirmModalBody').textContent = message;
  confirmCallback = callback;
  confirmModal.show();
}

// Show edit modal
let editCallback = null;
function showEditModal(currentValue, callback) {
  document.getElementById('confirmModalLabel').textContent = 'Editar';
  document.getElementById('confirmModalBody').innerHTML = `
    <input type="text" id="editInput" class="form-control" value="${currentValue}" 
      style="background-color: var(--card-color); color: var(--text-color); border: 1px solid var(--border-color);">
  `;
  
  editCallback = callback;
  confirmModal.show();
  
  // Add event listener for enter key
  const editInput = document.getElementById('editInput');
  
  editInput.focus();
  editInput.select();
  
  const keyHandler = function(e) {
    if (e.key === 'Enter') {
      const newValue = editInput.value.trim();
      if (newValue && typeof editCallback === 'function') {
        editCallback(newValue);
      }
      confirmModal.hide();
      editInput.removeEventListener('keydown', keyHandler);
    }
  };
  
  editInput.addEventListener('keydown', keyHandler);
  
  // Update the confirm button to call the edit callback
  const originalConfirmCallback = confirmCallback;
  confirmCallback = function() {
    const newValue = document.getElementById('editInput').value.trim();
    if (newValue && typeof editCallback === 'function') {
      editCallback(newValue);
    }
    // Restore original confirm callback
    confirmCallback = originalConfirmCallback;
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
      
      // Validate the data structure
      if (!Array.isArray(importedData)) {
        throw new Error('Formato de dados inválido.');
      }
      
      showConfirmModal('Esta ação irá substituir todos os dados atuais. Deseja continuar?', function() {
        macros = importedData;
        
        // Ensure all tasks have required properties
        macros.forEach(macro => {
          if (!macro.tasks) macro.tasks = [];
          macro.tasks.forEach(task => {
            if (!task.id) task.id = generateId();
            if (!task.status) task.status = 'pending';
            if (!task.priority) task.priority = 'medium';
            if (!task.createdAt) task.createdAt = new Date().toISOString();
          });
        });
        
        saveData();
        renderMacros();
        
        // Clear selected macro
        selectedMacroIndex = null;
        document.getElementById('selectedMacroTitle').textContent = 'Selecione uma Macro Tarefa';
        document.getElementById('taskList').innerHTML = '';
        document.getElementById('newTaskInput').disabled = true;
        document.getElementById('showTaskFormBtn').disabled = true;
        renderBoardView();
      });
    } catch (error) {
      alert('Erro ao importar dados: ' + error.message);
    }
    
    // Clear the file input
    event.target.value = '';
  };
  reader.readAsText(file);
}

// Clear completed tasks
function clearCompletedTasks() {
  if (selectedMacroIndex === null) {
    // Ask to reset all completed tasks from all macros
    showConfirmModal('Deseja resetar todas as tarefas concluídas para pendentes em todas as macro tarefas?', function() {
      macros.forEach(macro => {
        macro.tasks.forEach(task => {
          if (task.status === 'completed') {
            task.status = 'pending';
            delete task.completedAt;
          }
        });
      });
      saveData();
      renderMacros();
      renderTasks();
    });
  } else {
    // Ask to reset completed tasks only from selected macro
    showConfirmModal(`Deseja resetar todas as tarefas concluídas para pendentes em "${macros[selectedMacroIndex].name}"?`, function() {
      macros[selectedMacroIndex].tasks.forEach(task => {
        if (task.status === 'completed') {
          task.status = 'pending';
          delete task.completedAt;
        }
      });
      saveData();
      renderTasks();
    });
  }
}
