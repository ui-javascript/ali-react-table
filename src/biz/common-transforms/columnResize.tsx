import React from 'react'
import { fromEvent } from 'rxjs'
import * as op from 'rxjs/operators'
import styled from 'styled-components'
import { safeRenderHeader } from '../../common-utils/internals'
import isLeafNode from '../../common-utils/isLeafNode'
import { TableTransform } from '../interfaces'
import transformColumn from '../utils/transformColumn'

function clamp(min: number, x: number, max: number) {
  return Math.max(min, Math.min(max, x))
}

const ResizeHandle = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  right: -5px;
  width: 10px;
  cursor: col-resize;
  z-index: 1;
`

export interface ColumnResizeOptions {
  /** 每一列的宽度 */
  sizes: number[]

  /** 修改宽度的回调函数 */
  onChangeSizes(nextSizes: number[]): void

  /** 列的最小宽度，默认为 40 */
  minSize?: number
  /** 列的最大宽度，默认为 Infinity */
  maxSize?: number
  /** 是否在列的末尾追加可伸缩列，默认为 false */
  appendExpander?: boolean
  /** 是否在调整列宽时禁用 user-select，默认为 false */
  disableUserSelectWhenResizing?: boolean
}

export function columnResize({
  sizes,
  onChangeSizes,
  minSize = 40,
  maxSize = Infinity,
  appendExpander,
  disableUserSelectWhenResizing,
}: ColumnResizeOptions): TableTransform {
  const startResize = (colIndex: number, e: React.MouseEvent<HTMLSpanElement>) => {
    const startX = e.clientX
    const startSize = sizes[colIndex]

    const nextSizes$ = fromEvent<MouseEvent>(window, 'mousemove').pipe(
      op.takeUntil(fromEvent(window, 'mouseup')),
      op.map((e) => {
        const movingX = e.clientX
        const nextSizes = sizes.slice()
        nextSizes[colIndex] = clamp(minSize, startSize + (movingX - startX), maxSize)
        return nextSizes
      }),
    )

    let prevUserSelect = ''
    let docElemStyle: CSSStyleDeclaration

    if (disableUserSelectWhenResizing) {
      docElemStyle = document.documentElement.style
      prevUserSelect = docElemStyle.userSelect
      docElemStyle.userSelect = 'none'
      docElemStyle.cursor = 'col-resize'
    }

    nextSizes$.subscribe({
      next: onChangeSizes,
      complete() {
        if (disableUserSelectWhenResizing) {
          docElemStyle.userSelect = prevUserSelect
        }
      },
    })
  }

  const innerTransform = transformColumn((col, { range }) => {
    if (!isLeafNode(col)) {
      return col
    }

    const prevTitle = safeRenderHeader(col)

    return {
      ...col,
      width: sizes[range.start],
      title: (
        <>
          {prevTitle}
          <ResizeHandle
            className="resize-handle"
            onMouseDown={(e: React.MouseEvent<HTMLSpanElement>) => startResize(range.start, e)}
          />
        </>
      ),
      headerCellProps: {
        ...col.headerCellProps,
        style: {
          ...col.headerCellProps?.style,
          overflow: 'visible',
          position: 'relative',
        },
      },
    }
  })

  return (input) => {
    const { columns, dataSource } = innerTransform(input)
    return {
      columns: appendExpander ? columns.concat([{ name: '' }]) : columns,
      dataSource,
    }
  }
}
