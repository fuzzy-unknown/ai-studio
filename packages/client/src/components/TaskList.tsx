import type { Task } from '../types'
import { TaskCard } from './TaskCard'

interface Props {
  tasks: Task[]
  onRefresh?: () => void
  onRetry?: (task: Task) => void
}

export function TaskList({ tasks, onRefresh, onRetry }: Props) {
  if (tasks.length === 0)
    return <p className="empty-text">暂无生成记录</p>

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskCard key={task.taskId} task={task} onRefresh={onRefresh} onRetry={onRetry} />
      ))}
    </div>
  )
}
