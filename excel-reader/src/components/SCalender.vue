<template>
  <div class="calendar-container">
    <div v-if="calendarData.length" class="calendar-tools">
      <a-button size="mini" @click="refresh"><icon-sync /></a-button>
      <!-- <a-switch type="round" v-model="showDetail">
        <template #checked>
          详情
        </template>
        <template #unchecked>
          基本
        </template>
      </a-switch> -->
    </div>
    <div v-if="calendarData.length" class="calendar-weekday">
      <div class="calendar-day" v-for="(weekday, index) in weekDays" :key="index">
        <div class="calendar-date">{{ weekday.replace('星期', '') }}</div>
      </div>
    </div>
    <div
      v-for="(week, weekIndex) in calendarData"
      :key="weekIndex"
      class="calendar-week"
    >
      <div 
        v-for="(day, dayIndex) in week" 
        :key="dayIndex" 
        class="calendar-day" 
        :class="{ 'is-disabled-day': isIndexDisabled(day.id) }" 
      >
        <div v-if="day.isWorkday" class="calendar-marker"></div>
        <div class="calendar-day-wrap" v-if="day.hours >= 0" @click="() => toggleDisabledIndex(day.id)">
          <div class="calendar-date">
            {{ day.date.replace(/\w+\//, '') }}
          </div>
          <div 
            class="calendar-hours" 
            :class="{ 
                'is-not-complete' : day.markedTimes === 0,
                'is-half-complete': day.markedTimes === 1
              }"
          >
            <a-typography-text v-if="day.diffHours > 0" type="success" bold>
              {{ `${day.hours.toFixed(1)}` }}
            </a-typography-text>
            <a-typography-text v-else-if="day.diffHours < 0" type="danger" bold>
              {{ `${day.hours.toFixed(1)}` }}
            </a-typography-text>
            <a-typography-text v-else type="secondary" bold>
              {{ `${day.hours.toFixed(1)}` }}
            </a-typography-text>
          </div>
          <div class="calendar-hours-addtion">
            <div>{{ day.firstTime || '--' }}</div>
            <div>{{ day.lastTime || '--' }}</div>
          </div>
        </div>
        <div class="calendar-day-wrap" v-else>
          <div class="calendar-placeholder">
            <div class="calendar-date">&nbsp;</div>
            <div class="calendar-hours">&nbsp;</div>
            <div class="calendar-hours-addtion">&nbsp;</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkDate } from "@/utils/reader";
import { computed, ref, type PropType } from "vue";
import { IconSync } from '@arco-design/web-vue/es/icon';


const props = defineProps({
  data: { type: Array as PropType<WorkDate[]> ,default: ()=> []},
});

const parsedData = computed<Omit<WorkDate, 'standardHours'>[]>(() => {
  return props.data.map((item) => {
    const [date, weekday] = item.date.split(" ");
    return {
      id: item.id,
      date,
      weekday,
      hours: item.hours,
      diffHours: item.diffHours,
      markedTimes: item.markedTimes,
      firstTime: item.firstTime,
      lastTime: item.lastTime,
      isWorkday: item.isWorkday
    };
  });
});

type Item = typeof parsedData.value[0]

const weekDays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期天"];

const localeLongDateFormat = Intl.DateTimeFormat('zh-cn', { year: "numeric", month: "2-digit", day: "2-digit" })
const getLocaleLongDate = (date: Date) => {
  return localeLongDateFormat.format(date)
}
// 构建日历数据
const calendarData = computed(() => {
  if(!parsedData.value.length) return []

   // 工具函数：获取星期一的日期
  const getMonday = (date: Date) => {
    const day = date.getDay(); // 获取星期几（0 表示星期天）
    const diff = day === 0 ? -6 : 1 - day; // 若为星期天，调整到上周一
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  };

  // 工具函数：获取星期天的日期
  const getSunday = (date: Date) => {
    const day = date.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  };

  // 转换源数据为 Map，用于快速查找
  const dateMap = new Map<string, Item>();
  parsedData.value.forEach((item) => {
    dateMap.set(item.date, item);
  });

  // 找到第一天和最后一天的日期
  const firstDate = new Date(parsedData.value[0].date);
  const lastDate = new Date(parsedData.value[parsedData.value.length - 1].date);

  // 计算起点（第一周的星期一）和终点（最后一周的星期天）
  const startDate = getMonday(firstDate);
  const endDate = getSunday(lastDate);

  // 生成从起点到终点的完整日期范围
  const dateRange: Array<{ date: string; weekday: string }> = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const dateStr = getLocaleLongDate(currentDate);
    dateRange.push({
      date: dateStr,
      weekday: weekDays[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1], // 处理星期天为最后一天
    });
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }

  // 填充完整数据
  const filledData = dateRange.map((date) => {
    if (dateMap.has(date.date)) {
      const original = dateMap.get(date.date)!;
      return { ...original };
    } else {
      return { id: '', date: date.date, hours: -1, diffHours: 0, weekday: date.weekday, markedTimes: 0, isWorkday: false };
    }
  });

  // 按每 7 天分组为周
  const weeks: Array<Item[]> = [];
  for (let i = 0; i < filledData.length; i += 7) {
    weeks.push(filledData.slice(i, i + 7));
  }

  return weeks;
});

const showDetail = ref(false)

const disabledDates = defineModel<string[]>('disabledDates', { required:true })
function toggleDisabledIndex(id:string){
  if(id){
    if(!isIndexDisabled(id)){
      disabledDates.value.push(id)
    }
    else {
      disabledDates.value = disabledDates.value.filter(d => d !== id)
    }
  }
}
function isIndexDisabled(id:string){
  return disabledDates.value.includes(id)
}

function refresh(){
  showDetail.value = false
  disabledDates.value = []
}
</script>

<style scoped>
.calendar-container {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  user-select: none;
}

.calendar-tools {
  margin-bottom: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.calendar-weekday,.calendar-week {
  display: flex;
}

.calendar-day {
  flex: 1;
  text-align: center;
  border-bottom: 1px solid #ddd;
  width: calc(100% / 7);
  padding: 8px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
  
.calendar-day.is-disabled-day {
    text-decoration: line-through;
}

.calendar-day-wrap {
  height: 100%;
  cursor: pointer;
}

.calendar-weekday > .calendar-day{
  border-top: 1px solid #ddd;
}

.calendar-weekday > .calendar-day:first-child,
.calendar-week > .calendar-day:first-child {
  border-left: 1px solid #ddd;
}

.calendar-weekday > .calendar-day,
.calendar-week > .calendar-day {
  border-right: 1px solid #ddd;
}

.calendar-marker {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-bottom: 8px solid transparent;
  border-right: 8px solid #00B42A;
}

.calendar-date {
  font-size: 0.75em;
}

.calendar-hours {
  color: #555;
  border: 1px solid transparent;
}

.calendar-hours.is-half-complete{
  border: 1px dashed #ddd;
}

.calendar-hours.is-not-complete{
  border: 1px solid #ddd;
}

.calendar-hours.up {
  color: var(--success-6);
}

.calendar-hours.down {
  color: var(--danger-6);
}

.calendar-hours-addtion {
  font-size: 0.75em;
  color: var(--color-text-3);
}

.calendar-placeholder {
  color: #ccc;
}

.calendar-placeholder div {
  opacity: 0;
}
</style>
