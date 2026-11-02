import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef
} from 'react'
import { createModule, createItem, normalizeResume } from './moduleTypes.js'
import { useAuth } from './AuthContext.jsx'
import * as db from '../db/resumeDb.js'

const ResumeContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_META':
      return { ...state, meta: { ...state.meta, ...action.patch } }

    case 'ADD_MODULE': {
      const m = createModule(action.moduleType)
      return { ...state, modules: [...state.modules, m] }
    }

    case 'REMOVE_MODULE':
      return { ...state, modules: state.modules.filter((m) => m.id !== action.id) }

    case 'UPDATE_MODULE_TITLE':
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.id ? { ...m, title: action.title } : m
        )
      }

    case 'UPDATE_MODULE_DATA':
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.id ? { ...m, data: { ...m.data, ...action.patch } } : m
        )
      }

    case 'ADD_ITEM':
      return {
        ...state,
        modules: state.modules.map((m) => {
          if (m.id !== action.id || !m.data.items) return m
          return { ...m, data: { ...m.data, items: [...m.data.items, createItem(m.type)] } }
        })
      }

    case 'REMOVE_ITEM':
      return {
        ...state,
        modules: state.modules.map((m) => {
          if (m.id !== action.id || !m.data.items) return m
          return {
            ...m,
            data: { ...m.data, items: m.data.items.filter((it) => it.id !== action.itemId) }
          }
        })
      }

    case 'UPDATE_ITEM':
      return {
        ...state,
        modules: state.modules.map((m) => {
          if (m.id !== action.id || !m.data.items) return m
          return {
            ...m,
            data: {
              ...m.data,
              items: m.data.items.map((it) =>
                it.id === action.itemId ? { ...it, [action.key]: action.value } : it
              )
            }
          }
        })
      }

    case 'MOVE_ITEM': {
      // dir: -1 up, 1 down
      return {
        ...state,
        modules: state.modules.map((m) => {
          if (m.id !== action.id || !m.data.items) return m
          const items = [...m.data.items]
          const idx = items.findIndex((it) => it.id === action.itemId)
          const target = idx + action.dir
          if (idx < 0 || target < 0 || target >= items.length) return m
          ;[items[idx], items[target]] = [items[target], items[idx]]
          return { ...m, data: { ...m.data, items } }
        })
      }
    }

    case 'MOVE_MODULE': {
      const idx = state.modules.findIndex((m) => m.id === action.id)
      const target = idx + action.dir
      if (idx < 0 || target < 0 || target >= state.modules.length) return state
      const modules = [...state.modules]
      ;[modules[idx], modules[target]] = [modules[target], modules[idx]]
      return { ...state, modules }
    }

    case 'REORDER_MODULES': {
      // payload: ordered array of ids
      const map = new Map(state.modules.map((m) => [m.id, m]))
      const modules = action.order.map((id) => map.get(id)).filter(Boolean)
      return { ...state, modules }
    }

    case 'LOAD_RESUME':
      return action.resume

    case 'RESET':
      // 重置为一份空白简历（不再回退到任何示例内容）
      return db.blankResumeData()

    default:
      return state
  }
}

export function ResumeProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  // 初始状态为空白简历：编辑器只在打开某份简历后才渲染，这里仅是占位，不内置示例数据。
  const [state, dispatch] = useReducer(reducer, undefined, () => db.blankResumeData())
  const [resumes, setResumes] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ---- 显式保存（替代自动保存，编辑后需点“保存”才落库）----
  // 脏标记追踪两类改动：① 各模块内容/顺序/增删；② 全局排版设置(meta)。
  const [dirty, setDirty] = useState({}) // { [moduleId]: true }
  const [metaDirty, setMetaDirty] = useState(false)
  // 仅顺序/模块增删这类结构性变化会令“保存全部”和离开确认生效，但不再把每个老模块标脏。
  const [orderDirty, setOrderDirty] = useState(false)
  const savedRef = useRef(null) // { order, modules, meta }

  // 登录后加载该用户的简历列表；登出时清空，避免上一个账号的数据残留在内存里。
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setResumes([])
      setActiveId(null)
      setError(null)
      setLoading(false)
      savedRef.current = null
      setDirty({})
      setMetaDirty(false)
      setOrderDirty(false)
      dispatch({ type: 'RESET' })
      return
    }

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { resumes, activeId, data } = await db.bootstrap()
        if (cancelled) return
        setResumes(resumes)
        setActiveId(activeId || null)
        if (data) dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(data) })
        setError(null)
      } catch (e) {
        console.error('初始化失败：', e)
        if (!cancelled) setError(String(e && e.message ? e.message : e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, authLoading])

  const snapshot = (s) => ({
    order: s.modules.map((m) => m.id).join('|'),
    modules: s.modules.reduce((acc, m) => {
      acc[m.id] = JSON.stringify(m)
      return acc
    }, {}),
    meta: JSON.stringify(s.meta)
  })

  // 以“实际加载/保存的数据”重置已保存基线并清空脏标记。
  // 直接在加载点调用（而非依赖 effect 读取 state 闭包），避免时序/严格模式导致脏标记误报。
  const resetBaseline = (resumeData) => {
    if (!resumeData) return
    savedRef.current = snapshot(resumeData)
    setDirty({})
    setMetaDirty(false)
    setOrderDirty(false)
  }

  // 内容变化后，逐模块比对基线计算脏模块与脏设置；顺序变化单独标记，避免误伤未改动模块。
  useEffect(() => {
    if (!savedRef.current) return
    const cur = snapshot(state)
    const next = {}
    for (const id of Object.keys(cur.modules)) {
      const prev = savedRef.current.modules[id]
      if (prev === undefined) {
        next[id] = true // 新增模块需保存
      } else if (prev !== cur.modules[id]) {
        next[id] = true // 内容有改动
      }
    }
    setDirty(next)
    setMetaDirty(cur.meta !== savedRef.current.meta)
    setOrderDirty(cur.order !== savedRef.current.order)
  }, [state])

  // 落库：把当前整份简历写入后端。存储模型是一份整体，故“保存某模块”即保存整份。
  // 注意：简历「名称」与基本信息里的「姓名」已解耦——名称只在新建/拷贝/重命名时由用户指定，
  // 保存内容不再用姓名覆盖名称，避免刚取好的名称一保存就被改掉、导致重名校验形同虚设。
  const persist = useCallback(async () => {
    if (!activeId) return
    const cur = stateRef.current
    try {
      const list = await db.saveActive(activeId, {
        meta: cur.meta,
        modules: cur.modules
      })
      setResumes(list)
      resetBaseline(cur)
    } catch (err) {
      console.warn('保存失败：', err)
    }
  }, [activeId])

  const newResume = useCallback(async (name) => {
    const recName = String(name || '').trim() || '未命名'
    const { rec, list, activeId: nid } = await db.create(recName, db.blankResumeData())
    setResumes(list)
    setActiveId(nid)
    resetBaseline(rec.data)
    dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(rec.data) })
    return nid
  }, [])

  // 拷贝一份已有简历：后端深拷贝内容，随后把它载入编辑器。
  const copyResume = useCallback(async (sourceId, name) => {
    const { rec, list, activeId: nid } = await db.copy(sourceId, name)
    setResumes(list)
    setActiveId(nid)
    resetBaseline(rec.data)
    dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(rec.data) })
    return nid
  }, [])

  const switchResume = useCallback(
    async (id) => {
      if (id === activeId) return
      const data = await db.getResumeData(id)
      resetBaseline(data)
      setActiveId(id)
      setResumes(await db.getList())
      dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(data) })
    },
    [activeId]
  )

  // 放弃未保存的修改：从后端重新拉取当前简历，覆盖本地编辑并清空脏标记。
  const discardCurrent = useCallback(async () => {
    if (!activeId) return
    const data = await db.getResumeData(activeId)
    resetBaseline(data)
    dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(data) })
  }, [activeId])

  const renameResume = useCallback(async (id, name) => {
    setResumes(await db.rename(id, name))
  }, [])

  const deleteResume = useCallback(async (id) => {
    const list = await db.remove(id)
    setResumes(list)
    if (activeId === id) {
      const next = list[0]
      if (next) {
        const data = await db.getResumeData(next.id)
        resetBaseline(data)
        setActiveId(next.id)
        dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(data) })
      } else {
        const { rec, list: l2, activeId: nid2 } = await db.create('未命名', db.blankResumeData())
        setResumes(l2)
        setActiveId(nid2)
        resetBaseline(rec.data)
        dispatch({ type: 'LOAD_RESUME', resume: normalizeResume(rec.data) })
      }
    }
  }, [activeId])

  const actions = useMemo(
    () => ({
      setMeta: (patch) => dispatch({ type: 'SET_META', patch }),
      addModule: (moduleType) => dispatch({ type: 'ADD_MODULE', moduleType }),
      removeModule: (id) => dispatch({ type: 'REMOVE_MODULE', id }),
      updateTitle: (id, title) => dispatch({ type: 'UPDATE_MODULE_TITLE', id, title }),
      updateData: (id, patch) => dispatch({ type: 'UPDATE_MODULE_DATA', id, patch }),
      addItem: (id) => dispatch({ type: 'ADD_ITEM', id }),
      removeItem: (id, itemId) => dispatch({ type: 'REMOVE_ITEM', id, itemId }),
      updateItem: (id, itemId, key, value) =>
        dispatch({ type: 'UPDATE_ITEM', id, itemId, key, value }),
      moveItem: (id, itemId, dir) => dispatch({ type: 'MOVE_ITEM', id, itemId, dir }),
      moveModule: (id, dir) => dispatch({ type: 'MOVE_MODULE', id, dir }),
      reorderModules: (order) => dispatch({ type: 'REORDER_MODULES', order }),
      loadResume: (resume) => dispatch({ type: 'LOAD_RESUME', resume }),
      reset: () => dispatch({ type: 'RESET' })
    }),
    []
  )

  const isDirty = useCallback((id) => Boolean(dirty[id]), [dirty])
  const anyDirty = Object.keys(dirty).length > 0 || metaDirty || orderDirty

  const value = useMemo(
    () => ({
      state,
      actions,
      resumes,
      activeId,
      loading,
      error,
      dirty,
      isDirty,
      metaDirty,
      anyDirty,
      persist,
      discardCurrent,
      newResume,
      copyResume,
      switchResume,
      renameResume,
      deleteResume,
      orderDirty
    }),
    [
      state,
      actions,
      resumes,
      activeId,
      loading,
      error,
      dirty,
      isDirty,
      metaDirty,
      anyDirty,
      persist,
      discardCurrent,
      newResume,
      copyResume,
      switchResume,
      renameResume,
      deleteResume,
      orderDirty
    ]
  )
  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>
}

export function useResume() {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResume must be used within ResumeProvider')
  return ctx
}
