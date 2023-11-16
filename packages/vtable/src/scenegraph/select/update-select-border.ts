import type { IRect } from '@visactor/vrender';
import type { Scenegraph } from '../scenegraph';
import type { CellSubLocation } from '../../ts-types';
import { getCellMergeInfo } from '../utils/get-cell-merge';

export function updateAllSelectComponent(scene: Scenegraph) {
  scene.selectingRangeComponents.forEach((selectComp: { rect: IRect; role: CellSubLocation }, key: string) => {
    updateComponent(selectComp, key, scene);
  });
  scene.selectedRangeComponents.forEach((selectComp: { rect: IRect; role: CellSubLocation }, key: string) => {
    updateComponent(selectComp, key, scene);
  });
}

function updateComponent(selectComp: { rect: IRect; role: CellSubLocation }, key: string, scene: Scenegraph) {
  const [startColStr, startRowStr, endColStr, endRowStr] = key.split('-');
  let startCol = parseInt(startColStr, 10);
  let startRow = parseInt(startRowStr, 10);
  let endCol = parseInt(endColStr, 10);
  let endRow = parseInt(endRowStr, 10);
  // const cellsBounds;
  // 下面逻辑根据选中区域所属表格部分 来判断可视区域内容的选中单元格范围
  let visibleCellRange;
  switch (selectComp.role) {
    case 'rowHeader':
      visibleCellRange = scene.table.getBodyVisibleRowRange();
      if (visibleCellRange) {
        startRow = Math.max(startRow, visibleCellRange.rowStart);
        endRow = Math.min(endRow, visibleCellRange.rowEnd);
      }
      break;
    case 'columnHeader':
      visibleCellRange = scene.table.getBodyVisibleCellRange();
      if (visibleCellRange) {
        startCol = Math.max(startCol, visibleCellRange.colStart);
        endCol = Math.min(endCol, visibleCellRange.colEnd);
      }
      break;
    case 'cornerHeader':
      break;
    case 'bottomFrozen':
      visibleCellRange = scene.table.getBodyVisibleCellRange();
      if (visibleCellRange) {
        startCol = Math.max(startCol, visibleCellRange.colStart);
        endCol = Math.min(endCol, visibleCellRange.colEnd);
      }
      break;
    case 'rightFrozen':
      visibleCellRange = scene.table.getBodyVisibleCellRange();
      if (visibleCellRange) {
        startRow = Math.max(startRow, visibleCellRange.rowStart);
        endRow = Math.min(endRow, visibleCellRange.rowEnd);
      }
      break;
    case 'rightTopCorner':
      break;
    case 'leftBottomCorner':
      break;
    case 'rightBottomCorner':
      break;
    default:
      visibleCellRange = scene.table.getBodyVisibleCellRange();
      if (visibleCellRange) {
        startRow = Math.max(startRow, visibleCellRange.rowStart);
        endRow = Math.min(endRow, visibleCellRange.rowEnd);
        startCol = Math.max(startCol, visibleCellRange.colStart);
        endCol = Math.min(endCol, visibleCellRange.colEnd);
      }
      break;
  }
  const cellRange = scene.table.getCellRange(startCol, startRow);
  const colsWidth = scene.table.getColsWidth(cellRange.start.col, endCol);
  const rowsHeight = scene.table.getRowsHeight(cellRange.start.row, endRow);
  const firstCellBound = scene.highPerformanceGetCell(cellRange.start.col, cellRange.start.row).globalAABBBounds;
  // if (!cellsBounds) {
  //   // 选中区域在实际单元格区域外，不显示选择框
  //   selectComp.rect.setAttributes({
  //     visible: false
  //   });
  // } else {
  selectComp.rect.setAttributes({
    x: firstCellBound.x1 - scene.tableGroup.attribute.x, //坐标xy在下面的逻辑中会做适当调整
    y: firstCellBound.y1 - scene.tableGroup.attribute.y,
    width: colsWidth,
    height: rowsHeight,
    visible: true
  });
  // }

  //#region 判断是不是按着表头部分的选中框 因为绘制层级的原因 线宽会被遮住一半，因此需要动态调整层级
  const isNearRowHeader =
    // scene.table.scrollLeft === 0 &&
    cellRange.start.col === scene.table.frozenColCount;
  const isNearRightRowHeader =
    // scene.table.scrollLeft === 0 &&
    endCol === scene.table.colCount - scene.table.rightFrozenColCount - 1;
  const isNearColHeader =
    // scene.table.scrollTop === 0 &&
    cellRange.start.row === scene.table.frozenRowCount;
  const isNearBottomColHeader =
    // scene.table.scrollTop === 0 &&
    endRow === scene.table.rowCount - scene.table.bottomFrozenRowCount - 1;
  if (
    (isNearRowHeader && selectComp.rect.attribute.stroke[3]) ||
    (isNearRightRowHeader && selectComp.rect.attribute.stroke[1]) ||
    (isNearColHeader && selectComp.rect.attribute.stroke[0]) ||
    (isNearBottomColHeader && selectComp.rect.attribute.stroke[2])
  ) {
    if (isNearRowHeader && selectComp.rect.attribute.stroke[3]) {
      scene.tableGroup.insertAfter(
        selectComp.rect,
        selectComp.role === 'columnHeader'
          ? scene.cornerHeaderGroup
          : selectComp.role === 'bottomFrozen'
          ? scene.leftBottomCornerGroup
          : scene.rowHeaderGroup
      );
    }

    if (isNearBottomColHeader && selectComp.rect.attribute.stroke[2]) {
      scene.tableGroup.insertAfter(
        selectComp.rect,
        selectComp.role === 'rowHeader'
          ? scene.leftBottomCornerGroup
          : selectComp.role === 'rightFrozen'
          ? scene.rightBottomCornerGroup
          : scene.bottomFrozenGroup
      );
    }

    if (isNearColHeader && selectComp.rect.attribute.stroke[0]) {
      scene.tableGroup.insertAfter(
        selectComp.rect,
        selectComp.role === 'rowHeader'
          ? scene.cornerHeaderGroup
          : selectComp.role === 'rightFrozen'
          ? scene.rightTopCornerGroup
          : scene.colHeaderGroup
      );
    }
    if (isNearRightRowHeader && selectComp.rect.attribute.stroke[1]) {
      scene.tableGroup.insertAfter(
        selectComp.rect,
        selectComp.role === 'columnHeader'
          ? scene.rightTopCornerGroup
          : selectComp.role === 'bottomFrozen'
          ? scene.rightBottomCornerGroup
          : scene.rightFrozenGroup
      );
    }

    //#region 调整层级后 滚动情况下会出现绘制范围出界 如body的选中框 渲染在了rowheader上面，所有需要调整选中框rect的 边界
    if (
      selectComp.rect.attribute.x < scene.rowHeaderGroup.attribute.width &&
      // selectComp.rect.attribute.x + selectComp.rect.attribute.width > scene.rowHeaderGroup.attribute.width &&
      scene.table.scrollLeft > 0 &&
      (selectComp.role === 'body' || selectComp.role === 'columnHeader' || selectComp.role === 'bottomFrozen')
    ) {
      selectComp.rect.setAttributes({
        x: selectComp.rect.attribute.x + (scene.rowHeaderGroup.attribute.width - selectComp.rect.attribute.x),
        width: selectComp.rect.attribute.width - (scene.rowHeaderGroup.attribute.width - selectComp.rect.attribute.x)
      });
    }
    if (
      // selectComp.rect.attribute.x < scene.rightFrozenGroup.attribute.x &&
      scene.rightFrozenGroup.attribute.width > 0 && // right冻结列存在的情况下
      scene.rightFrozenGroup.attribute.height > 0 &&
      selectComp.rect.attribute.x + selectComp.rect.attribute.width > scene.rightFrozenGroup.attribute.x &&
      (selectComp.role === 'body' || selectComp.role === 'columnHeader' || selectComp.role === 'bottomFrozen')
    ) {
      selectComp.rect.setAttributes({
        x: selectComp.rect.attribute.x,
        width: scene.rightFrozenGroup.attribute.x - selectComp.rect.attribute.x
      });
    }
    if (
      selectComp.rect.attribute.y < scene.colHeaderGroup.attribute.height &&
      scene.table.scrollTop > 0 &&
      (selectComp.role === 'body' || selectComp.role === 'rowHeader' || selectComp.role === 'rightFrozen')
    ) {
      selectComp.rect.setAttributes({
        y: selectComp.rect.attribute.y + (scene.colHeaderGroup.attribute.height - selectComp.rect.attribute.y),
        height: selectComp.rect.attribute.height - (scene.colHeaderGroup.attribute.height - selectComp.rect.attribute.y)
      });
    }
    if (
      scene.bottomFrozenGroup.attribute.width > 0 &&
      scene.bottomFrozenGroup.attribute.height > 0 &&
      selectComp.rect.attribute.y + selectComp.rect.attribute.height > scene.bottomFrozenGroup.attribute.y &&
      (selectComp.role === 'body' || selectComp.role === 'rowHeader' || selectComp.role === 'rightFrozen')
    ) {
      selectComp.rect.setAttributes({
        y: selectComp.rect.attribute.y,
        height: scene.bottomFrozenGroup.attribute.y - selectComp.rect.attribute.y
      });
    }
    //#endregion
  } else {
    scene.tableGroup.insertAfter(
      selectComp.rect,
      selectComp.role === 'body'
        ? scene.bodyGroup
        : selectComp.role === 'columnHeader'
        ? scene.colHeaderGroup
        : selectComp.role === 'rowHeader'
        ? scene.rowHeaderGroup
        : selectComp.role === 'cornerHeader'
        ? scene.cornerHeaderGroup
        : selectComp.role === 'rightTopCorner'
        ? scene.rightTopCornerGroup
        : selectComp.role === 'rightFrozen'
        ? scene.rightFrozenGroup
        : selectComp.role === 'leftBottomCorner'
        ? scene.leftBottomCornerGroup
        : selectComp.role === 'bottomFrozen'
        ? scene.bottomFrozenGroup
        : scene.rightBottomCornerGroup
    );
  }
  //#endregion
}

export function updateCellSelectBorder(
  scene: Scenegraph,
  newStartCol: number,
  newStartRow: number,
  newEndCol: number,
  newEndRow: number
) {
  let startCol = Math.min(newEndCol, newStartCol);
  let startRow = Math.min(newEndRow, newStartRow);
  let endCol = Math.max(newEndCol, newStartCol);
  let endRow = Math.max(newEndRow, newStartRow);
  //#region region 校验四周的单元格有没有合并的情况，如有则扩大范围
  const extendSelectRange = () => {
    let isExtend = false;
    for (let col = startCol; col <= endCol; col++) {
      if (col === startCol) {
        for (let row = startRow; row <= endRow; row++) {
          const mergeInfo = getCellMergeInfo(scene.table, col, row);
          if (mergeInfo && mergeInfo.start.col < startCol) {
            startCol = mergeInfo.start.col;
            isExtend = true;
            break;
          }
        }
      }
      if (!isExtend && col === endCol) {
        for (let row = startRow; row <= endRow; row++) {
          const mergeInfo = getCellMergeInfo(scene.table, col, row);
          if (mergeInfo && mergeInfo.end.col > endCol) {
            endCol = mergeInfo.end.col;
            isExtend = true;
            break;
          }
        }
      }

      if (isExtend) {
        break;
      }
    }
    if (!isExtend) {
      for (let row = startRow; row <= endRow; row++) {
        if (row === startRow) {
          for (let col = startCol; col <= endCol; col++) {
            const mergeInfo = getCellMergeInfo(scene.table, col, row);
            if (mergeInfo && mergeInfo.start.row < startRow) {
              startRow = mergeInfo.start.row;
              isExtend = true;
              break;
            }
          }
        }
        if (!isExtend && row === endRow) {
          for (let col = startCol; col <= endCol; col++) {
            const mergeInfo = getCellMergeInfo(scene.table, col, row);
            if (mergeInfo && mergeInfo.end.row > endRow) {
              endRow = mergeInfo.end.row;
              isExtend = true;
              break;
            }
          }
        }

        if (isExtend) {
          break;
        }
      }
    }
    if (isExtend) {
      extendSelectRange();
    }
  };
  extendSelectRange();
  //#endregion
  scene.selectingRangeComponents.forEach((selectComp: { rect: IRect; role: CellSubLocation }, key: string) => {
    selectComp.rect.delete();
  });
  scene.selectingRangeComponents = new Map();

  let needRowHeader = false;
  let needRightRowHeader = false; // 右侧冻结
  let needColumnHeader = false;
  let needBottomColumnHeader = false; // 底部冻结
  let needBody = false;
  let needCornerHeader = false;
  let needRightTopCornerHeader = false;
  let needRightBottomCornerHeader = false;
  let needLeftBottomCornerHeader = false;
  if (startCol <= scene.table.frozenColCount - 1 && startRow <= scene.table.frozenRowCount - 1) {
    needCornerHeader = true;
  }
  if (endCol >= scene.table.colCount - scene.table.rightFrozenColCount && startRow <= scene.table.frozenRowCount - 1) {
    needRightTopCornerHeader = true;
  }

  if (startCol <= scene.table.frozenColCount - 1 && endRow >= scene.table.rowCount - scene.table.bottomFrozenRowCount) {
    needLeftBottomCornerHeader = true;
  }

  if (
    endCol >= scene.table.colCount - scene.table.rightFrozenColCount &&
    endRow >= scene.table.rowCount - scene.table.bottomFrozenRowCount
  ) {
    needRightBottomCornerHeader = true;
  }

  if (
    startCol <= scene.table.frozenColCount - 1 &&
    endRow >= scene.table.frozenRowCount &&
    startRow <= scene.table.rowCount - scene.table.bottomFrozenRowCount - 1
  ) {
    needRowHeader = true;
  }
  if (
    endCol >= scene.table.colCount - scene.table.rightFrozenColCount &&
    endRow >= scene.table.frozenRowCount &&
    startRow <= scene.table.rowCount - scene.table.bottomFrozenRowCount - 1
  ) {
    needRightRowHeader = true;
  }

  if (
    startRow <= scene.table.frozenRowCount - 1 &&
    endCol >= scene.table.frozenColCount &&
    startCol <= scene.table.colCount - scene.table.rightFrozenColCount - 1
  ) {
    needColumnHeader = true;
  }
  if (
    endRow >= scene.table.rowCount - scene.table.bottomFrozenRowCount &&
    endCol >= scene.table.frozenColCount &&
    startCol <= scene.table.colCount - scene.table.rightFrozenColCount - 1
  ) {
    needBottomColumnHeader = true;
  }
  if (
    startCol <= scene.table.colCount - scene.table.rightFrozenColCount - 1 &&
    endCol >= scene.table.frozenColCount &&
    startRow <= scene.table.rowCount - scene.table.bottomFrozenRowCount - 1 &&
    endRow >= scene.table.frozenRowCount
  ) {
    needBody = true;
  }

  // TODO 可以尝试不拆分三个表头和body【前提是theme中合并配置】 用一个SelectBorder 需要结合clip，并动态设置border的范围【依据区域范围 已经是否跨表头及body】
  if (needCornerHeader) {
    const cornerEndCol = Math.min(endCol, scene.table.frozenColCount - 1);
    const cornerEndRow = Math.min(endRow, scene.table.frozenRowCount - 1);
    const strokeArray = [true, !needColumnHeader, !needRowHeader, true];
    scene.createCellSelectBorder(
      startCol,
      startRow,
      cornerEndCol,
      cornerEndRow,
      'cornerHeader',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needRightTopCornerHeader) {
    const cornerStartCol = Math.max(startCol, scene.table.colCount - scene.table.rightFrozenColCount);
    const cornerEndRow = Math.min(endRow, scene.table.frozenRowCount - 1);
    const strokeArray = [true, true, !needRightRowHeader, !needColumnHeader];
    scene.createCellSelectBorder(
      cornerStartCol,
      startRow,
      endCol,
      cornerEndRow,
      'rightTopCorner',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }

  if (needLeftBottomCornerHeader) {
    const cornerEndCol = Math.min(endCol, scene.table.frozenColCount - 1);
    const cornerStartRow = Math.max(startRow, scene.table.rowCount - scene.table.bottomFrozenRowCount);
    const strokeArray = [!needRowHeader, !needBottomColumnHeader, true, true];
    scene.createCellSelectBorder(
      startCol,
      cornerStartRow,
      cornerEndCol,
      endRow,
      'leftBottomCorner',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needRightBottomCornerHeader) {
    const cornerStartCol = Math.max(startCol, scene.table.colCount - scene.table.rightFrozenColCount);
    const cornerStartRow = Math.max(startRow, scene.table.rowCount - scene.table.bottomFrozenRowCount);
    const strokeArray = [!needRightRowHeader, true, true, !needBottomColumnHeader];
    scene.createCellSelectBorder(
      cornerStartCol,
      cornerStartRow,
      endCol,
      endRow,
      'rightBottomCorner',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needColumnHeader) {
    const columnHeaderStartCol = Math.max(startCol, scene.table.frozenColCount);
    const columnHeaderEndCol = Math.min(endCol, scene.table.colCount - scene.table.rightFrozenColCount - 1);
    const columnHeaderEndRow = Math.min(endRow, scene.table.frozenRowCount - 1);
    const strokeArray = [true, !needRightTopCornerHeader, !needBody, !needCornerHeader];
    scene.createCellSelectBorder(
      columnHeaderStartCol,
      startRow,
      columnHeaderEndCol,
      columnHeaderEndRow,
      'columnHeader',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needBottomColumnHeader) {
    const columnHeaderStartCol = Math.max(startCol, scene.table.frozenColCount);
    const columnHeaderEndCol = Math.min(endCol, scene.table.colCount - scene.table.rightFrozenColCount - 1);
    const columnHeaderStartRow = Math.max(startRow, scene.table.rowCount - scene.table.bottomFrozenRowCount);
    const strokeArray = [!needBody, !needRightBottomCornerHeader, true, !needLeftBottomCornerHeader];
    scene.createCellSelectBorder(
      columnHeaderStartCol,
      columnHeaderStartRow,
      columnHeaderEndCol,
      endRow,
      'bottomFrozen',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needRowHeader) {
    const columnHeaderStartRow = Math.max(startRow, scene.table.frozenRowCount);
    const columnHeaderEndRow = Math.min(endRow, scene.table.rowCount - scene.table.bottomFrozenRowCount - 1);
    const columnHeaderEndCol = Math.min(endCol, scene.table.frozenColCount - 1);
    const strokeArray = [!needCornerHeader, !needBody, !needLeftBottomCornerHeader, true];
    scene.createCellSelectBorder(
      startCol,
      columnHeaderStartRow,
      columnHeaderEndCol,
      columnHeaderEndRow,
      'rowHeader',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needRightRowHeader) {
    const columnHeaderStartRow = Math.max(startRow, scene.table.frozenRowCount);
    const columnHeaderEndRow = Math.min(endRow, scene.table.rowCount - scene.table.bottomFrozenRowCount - 1);
    const columnHeaderStartCol = Math.max(startCol, scene.table.colCount - scene.table.rightFrozenColCount);
    const strokeArray = [!needRightTopCornerHeader, true, !needRightBottomCornerHeader, !needBody];
    scene.createCellSelectBorder(
      columnHeaderStartCol,
      columnHeaderStartRow,
      endCol,
      columnHeaderEndRow,
      'rightFrozen',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
  if (needBody) {
    const columnHeaderStartCol = Math.max(startCol, scene.table.frozenColCount);
    const columnHeaderStartRow = Math.max(startRow, scene.table.frozenRowCount);
    const columnHeaderEndCol = Math.min(endCol, scene.table.colCount - scene.table.rightFrozenColCount - 1);
    const columnHeaderEndRow = Math.min(endRow, scene.table.rowCount - scene.table.bottomFrozenRowCount - 1);
    const strokeArray = [!needColumnHeader, !needRightRowHeader, !needBottomColumnHeader, !needRowHeader];
    scene.createCellSelectBorder(
      columnHeaderStartCol,
      columnHeaderStartRow,
      columnHeaderEndCol,
      columnHeaderEndRow,
      'body',
      `${startCol}${startRow}${endCol}${endRow}`,
      strokeArray
    );
  }
}
