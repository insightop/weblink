/**
 * 表格渲染模块
 */

import { formatTime, formatDistance } from "../utils/format.js";
import { AppState, DeviceStatus, getAllDevicesForTable } from "./state.js";

// DataTables 实例
let dataTable = null;

/**
 * 初始化 DataTables
 * @param {Function} onRowClick - 行点击回调
 */
export function initDataTable(onRowClick) {
  const tableElement = document.getElementById("dataTable");
  if (!tableElement) return;

  dataTable = $(tableElement).DataTable({
    paging: false,
    searching: false,
    info: false,
    ordering: false,
    responsive: false,
    scrollX: true,
    scrollY: "calc(100vh - 200px)",
    scrollCollapse: true,
    autoWidth: false,
    deferRender: true,
    language: {
      emptyTable: "暂无数据，请连接设备后读取",
    },
    columnDefs: [
      { width: "200px", targets: 0, className: "text-center" }, // UID
      { width: "100px", targets: 1, className: "text-center" }, // 开机时长
      { width: "100px", targets: 2, className: "text-center" }, // 运行时长
      { width: "100px", targets: 3, className: "text-center" }, // 行驶里程
      { width: "100px", targets: 4, className: "text-center" }, // 累计开机
      { width: "100px", targets: 5, className: "text-center" }, // 累计运行
      { width: "100px", targets: 6, className: "text-center" }, // 累计里程
      { width: "80px", targets: 7, className: "text-center" }, // 温度
      { width: "80px", targets: 8, className: "text-center" }, // 卫星数
      { width: "80px", targets: 9, className: "text-center" }, // 定位精度
    ],
    createdRow: function (row, data) {
      const uid = data[0];
      const device = AppState.devices.get(uid);

      // 添加状态类
      if (device) {
        applyRowStatus(row, device.status);
      }

      // 添加点击事件
      $(row).on("click", function (e) {
        e.stopPropagation();
        onRowClick(uid);
      });
    },
    drawCallback: function () {
      applyAllRowStyles();
      restoreSelectedRow();
    },
  });

  // 窗口大小改变时调整表格
  window.addEventListener("resize", () => {
    if (dataTable) {
      dataTable.columns.adjust();
    }
  });
}

/**
 * 更新表格显示
 */
export function updateTableDisplay() {
  if (!dataTable) return;

  const devices = getAllDevicesForTable();

  // 转换为表格数据格式
  const tableData = devices.map((device) => {
    const data = device.data || {};
    return [
      device.uid,
      data.current ? formatTime(data.current.uptime) : "--",
      data.current ? formatTime(data.current.runtime) : "--",
      data.current ? formatDistance(data.current.distance) : "--",
      data.total ? formatTime(data.total.uptime) : "--",
      data.total ? formatTime(data.total.runtime) : "--",
      data.total ? formatDistance(data.total.distance) : "--",
      typeof data.temp !== "undefined" ? `${data.temp}℃` : "--",
      data.gnss?.satellite ?? "--",
      data.gnss?.precision ?? "--",
    ];
  });

  // 更新表格
  dataTable.clear();
  dataTable.rows.add(tableData);
  dataTable.draw();
}

/**
 * 应用行状态样式
 * @param {HTMLElement} row - 行元素
 * @param {string} status - 状态
 */
function applyRowStatus(row, status) {
  $(row).removeClass("status-online status-offline");

  if (status === DeviceStatus.ONLINE) {
    $(row).addClass("status-online");
  } else if (status === DeviceStatus.OFFLINE) {
    $(row).addClass("status-offline");
  }
}

/**
 * 应用所有行的样式
 */
function applyAllRowStyles() {
  if (!dataTable) return;

  dataTable.rows().every(function () {
    const row = this.node();
    const uid = $(row).find("td:first").text();
    const device = AppState.devices.get(uid);

    if (device) {
      applyRowStatus(row, device.status);
    }
  });
}

/**
 * 设置选中行
 * @param {string} uid - 设备UID
 */
export function setSelectedRow(uid) {
  if (!dataTable) return;

  // 清除之前的选中状态
  clearSelectedRow();

  // 设置新的选中UID
  AppState.ui.selectedUid = uid;

  // 找到对应的行并添加选中样式
  dataTable.rows().every(function () {
    const row = this.node();
    const rowUid = $(row).find("td:first").text();
    if (rowUid === uid) {
      $(row).addClass("selected");
      return false;
    }
  });
}

/**
 * 清除选中行
 */
export function clearSelectedRow() {
  if (!dataTable) return;

  dataTable.rows().every(function () {
    $(this.node()).removeClass("selected");
  });
}

/**
 * 恢复选中状态
 */
function restoreSelectedRow() {
  if (AppState.ui.selectedUid) {
    setSelectedRow(AppState.ui.selectedUid);
  }
}

/**
 * 清空表格
 */
export function clearTable() {
  if (dataTable) {
    dataTable.clear().draw();
  }
}

/**
 * 获取 DataTable 实例
 * @returns {Object} DataTable 实例
 */
export function getDataTable() {
  return dataTable;
}
