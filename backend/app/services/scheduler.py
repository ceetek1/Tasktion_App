from apscheduler.schedulers.background import BackgroundScheduler

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(print_job, "interval", seconds=5)
    scheduler.start()
def print_job():
    print("Scheduler is running")
