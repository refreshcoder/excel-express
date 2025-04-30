import * as xlsx from "xlsx";
import { v4 as uuidV4 } from 'uuid';

// number check
function numberify(origin: any) {  
  // 如果是number
  if (typeof origin === 'number') {
    return Number.isNaN(origin) ? undefined : origin;
  };

  if (typeof origin === 'string') {
    // 转换为字符串并移除非数字字符（保留小数点和负号）
    const str = String(origin).replace(/[^\d.-]/g, '');
    
    // 检查是否可以转换为有效数字
    const num = Number(str);
    if (Number.isNaN(num)) {
      return undefined;
    }
    
    return num;
  };

  return undefined;
}

function calculateHoursBetween(startTime: string, endTime: string): number {
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  const diffMinutes = endMinutes - startMinutes;
  return parseFloat((diffMinutes / 60).toFixed(1)); // 保留1位小数
}

const mergeHeaders = (parentHeader: string, childHeader?: string) => {
  return childHeader ? `${parentHeader}/${childHeader}` : parentHeader
}

const dateHeader = "时间";
const summaryHeader = '考勤概况';
const dutyHeader = "班次";
const timesHeader = "打卡次数(次)";
const checkedStatusHeader = "考勤结果";
const standardWorkTimeHeader = "标准工作时长(小时)";
const workTimeHeader = "实际工作时长(小时)";
const firstTimeHeader = "最早";
const lastTimeHeader = "最晚";

const dateField = mergeHeaders(dateHeader);
const dutyField = mergeHeaders(summaryHeader, dutyHeader);
const timesField = mergeHeaders(summaryHeader, timesHeader);
const checkedStatusField = mergeHeaders(summaryHeader, checkedStatusHeader);
const standardWorkTimeField = mergeHeaders(summaryHeader, standardWorkTimeHeader);
const workTimeField = mergeHeaders(summaryHeader, workTimeHeader);
const firstTimeField = mergeHeaders(summaryHeader, firstTimeHeader);
const lastTimeField = mergeHeaders(summaryHeader, lastTimeHeader);

const stringifyValue = (v: string | number | undefined) => {
  if (typeof v === 'string') {
    if(v === '--') return ''
    return v
  }
  if (typeof v === 'number') {
    if(isNaN(v)) return ''
    return `${v}`
  }
  return ''
}
type Row<H extends string, V = unknown> = Record<H, V>

enum DutyType {
  Free = '休息'
}

enum CheckedStatus {
  Normal = '正常',
  DayOff = '请假',
  FreeNormal = '正常（休息）'
}

// 合并前两行的数据
function mergeRows(row1: (string)[], row2: string[]) {
  const mergedData = [];
  const header = row1;
  const values = row2;

  let lastHeader = ''

  for (let i = 0; i < header.length; i++) {
    if(!!header[i]){
      lastHeader = header[i]
    }
    const value = mergeHeaders(lastHeader, values[i])
    mergedData.push(value);
  }

  return mergedData;
}

// 获取工作表数据
function getSheetData(worksheet: xlsx.WorkSheet) {
  const headerStartRow = 2; // 从第三行开始
  const headers = xlsx.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    range: headerStartRow,
  });
  const [header1, header2] = headers;
  const fullHeader = mergeRows(header1, header2);
  console.log(header1, header2, fullHeader)

  const valueStartRow = 4; // 从第五行开始
  const jsonData = xlsx.utils.sheet_to_json<Row<string, string | number>>(worksheet, {
    header: fullHeader,
    range: valueStartRow,
  });

  const res = jsonData.map((item) => {
    const newItem: Row<string, string> = {};

    // 遍历每个字段并应用getValue函数
    for (const key in item) {
      if (item.hasOwnProperty(key)) {
        newItem[key] = stringifyValue(item[key]);
      }
    }

    return newItem;
  })

  return res
}

// 转换筛选条件
function convertFilters({
  duty,
  checkedStatus,
  times,
}: {
  duty?: string;
  checkedStatus?: string;
  times?: string;
}) {
  const filters: Record<string, ((value: any) => boolean) | undefined> = {
    [dutyField]: undefined,
    [checkedStatusField]: undefined,
    [timesField]: undefined,
  };

  if (duty) {
    if (duty === "非休息") {
      filters[dutyField] = (t) => t !== DutyType.Free;
    }
  }

  if (checkedStatus) {
    if (checkedStatus === "正常") {
      filters[checkedStatusField] = (t) => t === CheckedStatus.Normal;
    } else if (checkedStatus === "非请假休息") {
      filters[checkedStatusField] = (t) =>
        !t.includes(CheckedStatus.DayOff) && !t.includes(CheckedStatus.FreeNormal);
    }
  }

  if (times) {
    if (times === "2") {
      filters[timesField] = (t) => numberify(t) === 2;
    }
  }

  return filters;
}

// 检查是否满足所有过滤条件
function filterItemWithFilters(
  item: any,
  filters: Record<string, ((value: any) => boolean) | undefined>
) {
  return Object.keys(filters).every((field) => {
    const filter = filters[field];
    return filter ? filter(item[field]) : true;
  });
}

export function fromWorkDateListToTimeResult(
  workDateList:  WorkDate[],
  superStandardWorkTime: number,
){
  const workDays = workDateList.length;

  const standardWorkTimeTotal = Number(
    workDateList
      .map((item) => item.standardHours)
      .reduce((pre, cur) => pre + cur, 0)
      .toFixed(2)
  );

  const workTimeTotal = Number(
    workDateList
      .map((item) => item.hours)
      .reduce((pre, cur) => pre + cur, 0)
      .toFixed(2)
  );

  console.info(workDateList)

  const standardWorkTimeDaily = Number(workDateList[0]?.standardHours ?? superStandardWorkTime);

  const workTimeDaily = workDays ? Number((workTimeTotal / workDays).toFixed(2)) : 0;

  const overWorkTime = Number(
    (workTimeTotal - standardWorkTimeTotal).toFixed(2)
  );

  return {
    standardWorkTimeDaily,
    standardWorkTimeTotal,
    workTimeDaily,
    workTimeTotal,
    workDays,
    overWorkTime,
  };
}

function getWorkDateList(
  workTimeList: Record<string, string>[],
  filters: Record<string, ((value: any) => boolean) | undefined>,
  superStandardWorkTime: number,
  strictTime: boolean
){
  const checkedWorkTimeList = workTimeList.filter((item) =>
    filterItemWithFilters(item, filters)
  );

  console.log(checkedWorkTimeList)

  const workDateList = checkedWorkTimeList.map((item) => {
    const standardWorkTime = numberify(item[standardWorkTimeField]) ?? superStandardWorkTime;
    const markedTimes = numberify(item[timesField]) ?? 0;

    const firstTimeStr = item[firstTimeField]
    const lastTimeStr = item[lastTimeField]
    const strictRealWorkTime = (firstTimeStr && lastTimeStr) ? calculateHoursBetween(firstTimeStr, lastTimeStr) : undefined


    const realWorkTime = (!strictTime ? numberify(item[workTimeField]) : strictRealWorkTime) ?? standardWorkTime;
    const isWorkday = item[dutyField] !== DutyType.Free;
    return {
      id: uuidV4(),
      date: item[dateField],
      hours: realWorkTime,
      standardHours: standardWorkTime,
      diffHours: realWorkTime - standardWorkTime,
      markedTimes,
      firstTime: firstTimeStr,
      lastTime: lastTimeStr,
      isWorkday,
    };
  });

  return workDateList.reverse()
}

export interface WorkDate {
  id: string;
  date: string;
  hours: number;
  standardHours: number;
  diffHours: number;
  markedTimes: number;
  firstTime?: string;
  lastTime?: string;
  isWorkday?: boolean;
};
export interface ParseRes {
  weeks: WorkDate[];
  detail: Record<string, any>;
}

// 主函数：解析文件并应用筛选
export async function parseExcelFile(
  file: File,
  filters: { duty?: string; checkedStatus?: string; times?: string },
  standardHours: number,
  strictTime: boolean
) {
  const reader = new FileReader();

  return new Promise<WorkDate[]>((resolve, reject) => {
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const sheetData = getSheetData(worksheet);
        const filterCriteria = convertFilters(filters);
        const result = getWorkDateList(sheetData, filterCriteria, standardHours, strictTime)

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
