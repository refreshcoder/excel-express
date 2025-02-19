import * as xlsx from "xlsx";
import { v4 as uuidV4 } from 'uuid' 

const dateField = "时间";
const dutyField = "班次";
const timesField = "打卡次数(次)";
const checkedStatusField = "校准状态";
const standardWorkTimeField = "标准工作时长(小时)";
const workTimeField = "实际工作时长(小时)";

// 合并前两行的数据
function mergeRows(row1: string[], row2: string[]) {
  const mergedData = [];
  const header = row1;
  const values = row2;

  for (let i = 0; i < header.length; i++) {
    const value = !!values[i] ? values[i] : header[i];
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

  const valueStartRow = 4; // 从第五行开始
  const jsonData = xlsx.utils.sheet_to_json<any>(worksheet, {
    header: fullHeader,
    range: valueStartRow,
  });

  return jsonData;
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
      filters[dutyField] = (t) => t !== "休息";
    }
  }

  if (checkedStatus) {
    if (checkedStatus === "正常") {
      filters[checkedStatusField] = (t) => t === "正常";
    } else if (checkedStatus === "非请假休息") {
      filters[checkedStatusField] = (t) =>
        !t.includes("请假") && !t.includes("休息");
    }
  }

  if (times) {
    if (times === "2") {
      filters[timesField] = (t) => t === 2;
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
){
  const checkedWorkTimeList = workTimeList.filter((item) =>
    filterItemWithFilters(item, filters)
  );

  const workDateList = checkedWorkTimeList.map((item) => {
    const standardWorkTime = item[standardWorkTimeField] ? Number(item[standardWorkTimeField]) : superStandardWorkTime;
    const defaultWorkTime = Number(item[timesField]) === 2 ? 0 : standardWorkTime;
    const numberfyWorkTime = Number(item[workTimeField]);
    const realWorkTime = !Number.isNaN(numberfyWorkTime)
      ? numberfyWorkTime
      : defaultWorkTime;
    return {
      id: uuidV4(),
      date: item[dateField],
      hours: realWorkTime,
      standardHours: standardWorkTime,
      diffHours: realWorkTime - standardWorkTime,
    };
  });

  return workDateList.sort((a, b) => a.date.localeCompare(b.date))
}

// 计算工作时长详情
function getWorkTimeDetail(
  workTimeList: any[],
  filters: Record<string, ((value: any) => boolean) | undefined>
) {
  const checkedWorkTimeList = workTimeList.filter((item) =>
    filterItemWithFilters(item, filters)
  );

  const standardWorkTimeDaily = checkedWorkTimeList[0]
    ? Number(checkedWorkTimeList[0][standardWorkTimeField])
    : 9;

  const workDays = checkedWorkTimeList.length;
  const standardWorkTimeTotal = standardWorkTimeDaily * workDays;

  const workDateList = checkedWorkTimeList.map((item) => {
    const defaultWorkTime = item[timesField] === 2 ? 0 : standardWorkTimeDaily;
    const numberfyWorkTime = Number(item[workTimeField]);
    const realWorkTime = !Number.isNaN(numberfyWorkTime)
      ? numberfyWorkTime
      : defaultWorkTime;
    return {
      date: item[dateField],
      hours: realWorkTime,
      diffHours: realWorkTime - standardWorkTimeDaily,
    };
  });

  const workTimeTotal = Number(
    workDateList
      .map((item) => item.hours)
      .reduce((pre, cur) => pre + cur, 0)
      .toFixed(2)
  );

  const workTimeDaily = Number((workTimeTotal / workDays).toFixed(2));
  const overWorkTime = Number(
    (workTimeTotal - standardWorkTimeTotal).toFixed(2)
  );

  return {
    weeks: workDateList.reverse(),
    detail: {
      工作天数: workDays,
      [`每日${standardWorkTimeField}`]: standardWorkTimeDaily,
      [`平均${workTimeField}`]: workTimeDaily,
      [`累计${standardWorkTimeField}`]: standardWorkTimeTotal,
      [`累计${workTimeField}`]: workTimeTotal,
      [`累计${workTimeField}差额`]: overWorkTime,
    },
  };
}

export interface WorkDate  {
  id: string;
  date: string;
  hours: number;
  standardHours: number;
  diffHours: number;
};
export interface ParseRes {
  weeks: WorkDate[];
  detail: Record<string, any>;
}

// 主函数：解析文件并应用筛选
export async function parseExcelFile(
  file: File,
  filters: { duty?: string; checkedStatus?: string; times?: string },
  standardHours: number
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
        const result = getWorkDateList(sheetData, filterCriteria, standardHours)

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
