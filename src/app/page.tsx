'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboardStats, getActivities, type DashboardStats } from '@/lib/db';
import type { Activity } from '@/types';
import styles from './page.module.css';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [statsData, activitiesData] = await Promise.all([
        getDashboardStats(),
        getActivities(),
      ]);
      setStats(statsData);
      setActivities(activitiesData);
      setMounted(true);
    }
    loadData();
  }, []);

  if (!mounted) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <div>
            <div className="skeleton" style={{ width: '200px', height: '40px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ width: '300px', height: '20px' }}></div>
          </div>
        </div>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: '140px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Posts This Week',
      value: stats?.postsThisWeek || 0,
      icon: '📊',
      trend: '+12%',
      trendUp: true,
      href: '/posts'
    },
    {
      label: 'Scheduled',
      value: stats?.scheduledPosts || 0,
      icon: '📅',
      trend: 'Next: 2h',
      trendUp: true,
      href: '/posts?status=scheduled'
    },
    {
      label: 'Published',
      value: stats?.publishedThisMonth || 0,
      icon: '✅',
      trend: '+5%',
      trendUp: true,
      href: '/posts?status=published'
    },
    {
      label: 'Drafts',
      value: stats?.drafts || 0,
      icon: '📝',
      trend: 'Active',
      trendUp: false,
      href: '/posts?status=draft'
    }
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back! Here&apos;s what&apos;s happening with your content.</p>
        </div>
        <div className={styles.dateDisplay}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className={styles.welcomeSection}>
        <div className={styles.welcomeText}>
          <h2>Let AI create your next viral post</h2>
          <p>Generate platform-optimized content in seconds. Just describe your topic.</p>
        </div>
        <Link href="/ai-compose" className={styles.createButton}>
          <span>✨ Create with AI</span>
        </Link>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className={`${styles.statCard} animate-fadeIn`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statIcon}>{stat.icon}</span>
            </div>
            <span className={styles.statValue}>{stat.value}</span>
            <div className={styles.statTrend}>
              <span className={stat.trendUp ? styles.trendUp : styles.trendDown}>
                {stat.trend}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        <section>
          <h2 className={styles.sectionTitle}>
            <span>Recent Activity</span>
          </h2>
          <div className={styles.activityFeed}>
            {activities.length === 0 ? (
              <div className={styles.emptyState}>No recent activity</div>
            ) : (
              activities.slice(0, 5).map((activity, index) => (
                <div key={activity.id} className={`${styles.activityItem} animate-slideIn`} style={{ animationDelay: `${index * 100}ms` }}>
                  <div className={styles.activityIcon} style={{
                    background: activity.type === 'published' ? 'rgba(16, 185, 129, 0.2)' :
                      activity.type === 'scheduled' ? 'rgba(59, 130, 246, 0.2)' :
                        'rgba(139, 92, 246, 0.2)',
                    color: activity.type === 'published' ? '#10b981' :
                      activity.type === 'scheduled' ? '#3b82f6' :
                        '#8b5cf6'
                  }}>
                    {activity.type === 'published' ? '✅' : activity.type === 'scheduled' ? '📅' : '📝'}
                  </div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityMessage}>{activity.message}</p>
                    <span className={styles.activityTime}>
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
