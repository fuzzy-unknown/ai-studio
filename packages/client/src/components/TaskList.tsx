import type { Task } from '../types'
import { TaskCard } from './TaskCard'

interface Props {
  tasks: Task[]
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  onRetry?: (task: Task) => void
}

export function TaskList({ tasks, hasMore, onLoadMore, onRefresh, onRetry }: Props) {
  if (tasks.length === 0)
    return <p className="empty-text">暂无生成记录</p>

  return (
    <>
      <div className="task-list">
        {tasks.map(task => (
          <TaskCard key={task.taskId} task={task} onRefresh={onRefresh} onRetry={onRetry} />
        ))}
      </div>
      {hasMore && (
        <button type="button" className="load-more-btn" onClick={onLoadMore}>
          加载更多
        </button>
      )}
    </>
  )
}
